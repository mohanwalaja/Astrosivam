import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES,
  mimeEncodedSize,
  planAttachmentBatches,
  resolveMaxAttachmentEncodedBytes
} from '../server/services/attachmentBatching.js';
import { sendFamilyOrderApprovalEmail } from '../server/services/emailService.js';
import { db } from '../server/db/store.js';

const pass = (name: string) => console.log(`  [PASS] ${name}`);
const MB = 1024 * 1024;

function attachment(name: string, bytes: number) {
  return { filename: name, content: Buffer.alloc(bytes, 0x41), contentType: 'application/pdf' };
}

async function run() {
  console.log('--- FAMILY ATTACHMENT BUDGET & SPLIT DELIVERY ---');

  // MIME base64 inflates raw bytes by 4/3.
  assert.ok(mimeEncodedSize(0) >= 512 && mimeEncodedSize(0) < 1024, 'empty parts still account for MIME headers');
  assert.ok(mimeEncodedSize(3 * MB) > 4 * MB, 'base64 expansion is accounted for');
  assert.ok(mimeEncodedSize(3 * MB) < 4.1 * MB, 'base64 expansion is not overestimated');
  pass('Encoded size estimation accounts for MIME base64 expansion');

  // Budget configuration: MB env wins, byte env is honoured, defaults apply.
  assert.equal(resolveMaxAttachmentEncodedBytes({ FAMILY_EMAIL_MAX_ATTACHMENT_MB: '5' } as any), 5 * MB);
  assert.equal(resolveMaxAttachmentEncodedBytes({ FAMILY_EMAIL_MAX_ATTACHMENT_BYTES: String(3 * MB) } as any), 3 * MB);
  assert.equal(resolveMaxAttachmentEncodedBytes({} as any), DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES);
  assert.equal(
    resolveMaxAttachmentEncodedBytes({ FAMILY_EMAIL_MAX_ATTACHMENT_MB: '0.0001' } as any),
    DEFAULT_MAX_ATTACHMENT_ENCODED_BYTES,
    'an unusable value falls back to the default instead of disabling the cap'
  );
  pass('Per-message attachment budget is configurable and always falls back to a safe default');

  // Planning keeps order, respects the budget and isolates a single oversize file.
  const mixed = [attachment('a.pdf', 4 * MB), attachment('b.pdf', 4 * MB), attachment('c.pdf', 4 * MB)];
  const plan = planAttachmentBatches(mixed, 12 * MB);
  assert.equal(plan.batches.length, 2, 'three reports need two messages at a 12 MB budget');
  assert.deepEqual(plan.batches[0].map(a => a.filename), ['a.pdf', 'b.pdf']);
  assert.deepEqual(plan.batches[1].map(a => a.filename), ['c.pdf']);
  assert.equal(plan.oversizeFiles.length, 0);
  assert.equal(plan.totalBytes, 12 * MB);
  assert.ok(plan.totalEncodedBytes > plan.totalBytes, 'the plan reports encoded totals too');

  const oversize = planAttachmentBatches([attachment('huge.pdf', 40 * MB), attachment('small.pdf', 1 * MB)], 12 * MB);
  assert.deepEqual(oversize.oversizeFiles, ['huge.pdf']);
  assert.equal(oversize.batches.length, 2);
  assert.deepEqual(oversize.batches[0].map(a => a.filename), ['huge.pdf'], 'an unsplittable file ships alone');
  assert.deepEqual(oversize.batches[1].map(a => a.filename), ['small.pdf']);
  pass('Batching preserves order, respects the budget, and isolates unsplittable files');

  // End-to-end: a family bundle too large for one message is delivered in parts.
  const originalSettings = structuredClone(db.getSettings());
  const sentMessages: any[] = [];
  try {
    const orders = [1, 2, 3].map(index => ({
      id: `ord_batch_${index}`,
      orderNumber: `BATCH-${index}`,
      userId: 'usr_batch',
      userName: `Devotee ${index}`,
      userEmail: 'family@example.test',
      userMobile: '+6790000000',
      serviceType: 'BIRTH_JATHAGAM',
      language: 'en',
      country: 'Fiji',
      currency: 'FJD',
      amount: 35,
      serviceMode: 'PAID',
      paymentMethod: 'MPAISA',
      paymentReference: `REF-${index}`,
      status: 'PROCESSING',
      emailStatus: 'PENDING',
      emailDeliveryAttempts: 0,
      groupId: 'GRP-BATCH',
      inputPayload: { name: `Devotee ${index}`, dob: '1990-01-01', birthPlace: 'Suva' },
      hasPdf: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })) as any;

    const reports = orders.map((order: any) => ({
      order,
      pdfBuffer: Buffer.alloc(3 * MB, 0x42),
      fileName: `report-${order.orderNumber}.pdf`
    }));

    const fakeTransporter = {
      sendMail: async (message: any) => {
        sentMessages.push(message);
        return { messageId: `test-${sentMessages.length}` };
      }
    } as any;

    const previousBudget = process.env.FAMILY_EMAIL_MAX_ATTACHMENT_MB;
    process.env.FAMILY_EMAIL_MAX_ATTACHMENT_MB = '10';
    try {
      const result = await sendFamilyOrderApprovalEmail(
        orders,
        reports,
        Buffer.alloc(2 * MB, 0x43),
        'ASTRO_SIVAM_Family_Invoice_GRP-BATCH.pdf',
        undefined,
        fakeTransporter
      );

      assert.equal(sentMessages.length > 1, true, 'a bundle above the budget is split');
      assert.equal(result.partCount, sentMessages.length);
      assert.equal(result.success, true);
      assert.match(result.message, /accepted by the SMTP transport/);
      assert.equal(sentMessages.length, result.partCount);
      sentMessages.forEach((message, index) => {
        const encoded = message.attachments
          .filter((a: any) => a.cid === undefined)
          .reduce((sum: number, a: any) => sum + mimeEncodedSize(a.content?.length || 0), 0);
        assert.ok(encoded <= 10 * MB + 4096, `part ${index + 1} stays inside the configured budget`);
        if (index > 0) assert.match(message.subject, /\(Part \d+ of \d+\)/, 'continuation emails are labelled');
      });
      assert.match(sentMessages[0].subject, /\(Part 1 of 2\)/);
      pass('Oversized family bundles are split into budget-sized emails with labelled subjects');

      // The six-report checkout maximum plus larger internal stress bundles retain
      // every preview-quality report and exactly one consolidated invoice.
      const repeatedReportBuffer = Buffer.alloc(3 * MB, 0x42);
      const repeatedInvoiceBuffer = Buffer.alloc(2 * MB, 0x43);
      for (const chartCount of [6, 10, 15]) {
        sentMessages.length = 0;
        const familyOrders = Array.from({ length: chartCount }, (_, index) => ({
          ...orders[0],
          id: `ord_large_${chartCount}_${index + 1}`,
          orderNumber: `LARGE-${chartCount}-${index + 1}`,
          userName: `Family Member ${index + 1}`,
          groupId: `GRP-LARGE-${chartCount}`,
          inputPayload: { name: `Family Member ${index + 1}`, dob: '1990-01-01', birthPlace: 'Suva' }
        })) as any;
        const familyReports = familyOrders.map((order: any) => ({
          order,
          pdfBuffer: repeatedReportBuffer,
          fileName: `preview-report-${order.orderNumber}.pdf`
        }));

        const delivery = await sendFamilyOrderApprovalEmail(
          familyOrders,
          familyReports,
          repeatedInvoiceBuffer,
          `preview-family-invoice-${chartCount}.pdf`,
          undefined,
          fakeTransporter
        );
        const deliveredNames = sentMessages.flatMap(message =>
          message.attachments
            .filter((a: any) => a.cid === undefined)
            .map((a: any) => a.filename)
        );
        assert.equal(delivery.success, true, `${chartCount}-chart delivery is accepted`);
        assert.ok(delivery.partCount > 1, `${chartCount}-chart bundle is split into safe email parts`);
        assert.equal(delivery.partCount, sentMessages.length);
        assert.equal(deliveredNames.length, chartCount + 1, 'all reports plus the one invoice are attached');
        assert.equal(new Set(deliveredNames).size, chartCount + 1, 'no PDF is silently omitted or duplicated');
        assert.equal(
          deliveredNames.filter((name: string) => name === `preview-family-invoice-${chartCount}.pdf`).length,
          1,
          'the consolidated invoice is attached exactly once'
        );
        sentMessages.forEach((message, index) => {
          const encoded = message.attachments.reduce(
            (sum: number, a: any) => sum + mimeEncodedSize(a.content?.length || 0),
            0
          );
          assert.ok(encoded <= 10 * MB - 120 * 1024, `${chartCount}-chart part ${index + 1} reserves room for logo/body overhead`);
        });
        pass(`${chartCount}-chart bundle is split without losing any preview PDF or the invoice`);
      }

      // A failed part is reported honestly instead of being called a success.
      sentMessages.length = 0;
      let call = 0;
      const flakyTransporter = {
        sendMail: async (message: any) => {
          call += 1;
          if (call === 2) throw new Error('SMTP 552 message too large');
          sentMessages.push(message);
          return { messageId: `flaky-${call}` };
        }
      } as any;
      const partial = await sendFamilyOrderApprovalEmail(
        orders,
        reports,
        Buffer.alloc(2 * MB, 0x43),
        'ASTRO_SIVAM_Family_Invoice_GRP-BATCH.pdf',
        undefined,
        flakyTransporter
      );
      assert.equal(partial.success, false, 'a partially delivered bundle is not reported as success');
      assert.match(partial.message, /partially delivered|failed/i);
      pass('Partial family delivery is reported as a failure so the admin can retry');

      // A missing transporter never claims success.
      sentMessages.length = 0;
      const unconfigured = await sendFamilyOrderApprovalEmail(orders, reports, Buffer.alloc(1024), 'invoice.pdf', undefined, null);
      assert.equal(unconfigured.success, false);
      assert.match(unconfigured.message, /SMTP is not configured/);
      pass('Family delivery without a transport reports no success and sends nothing');
    } finally {
      if (previousBudget === undefined) delete process.env.FAMILY_EMAIL_MAX_ATTACHMENT_MB;
      else process.env.FAMILY_EMAIL_MAX_ATTACHMENT_MB = previousBudget;
    }
  } finally {
    db.updateSettings(originalSettings, { id: 'test', name: 'Attachment budget cleanup' });
  }
}

run().then(() => {
  console.log('\nAttachment budget & split delivery passed.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
