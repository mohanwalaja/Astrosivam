import { getCurrentTimezoneOffset, getTimeZoneIdForCoordinates } from '../lib/timezone.js';

export interface LocationData {
  placeName: string;
  country: string;
  latitude: number;
  longitude: number;
  timezoneOffsetHours: number;
  timeZoneId?: string;
  state?: string;
  city?: string;
  area?: string;
}

export interface CityInfo {
  name: string;
  latitude: number;
  longitude: number;
  popularAreas?: string[];
}

export interface StateInfo {
  name: string;
  cities: CityInfo[];
}

export interface CountryInfo {
  code: string;
  name: string;
  timezoneOffsetHours: number;
  states: StateInfo[];
}

export const WORLDWIDE_LOCATIONS: CountryInfo[] = [
  {
    code: 'IN',
    name: 'India',
    timezoneOffsetHours: 5.5,
    states: [
      {
        name: 'Tamil Nadu',
        cities: [
          { name: 'Chennai', latitude: 13.0827, longitude: 80.2707, popularAreas: ['T. Nagar', 'Mylapore', 'Anna Nagar', 'Adyar', 'Velachery', 'Tambaram', 'Guindy', 'Porur', 'Egmore', 'Royapettah', 'Nungambakkam', 'Perambur', 'Saidapet', 'Thiruvanmiyur', 'Besant Nagar', 'Ambattur', 'Avadi', 'Chromepet', 'Medavakkam', 'Sholinganallur'] },
          { name: 'Coimbatore', latitude: 11.0168, longitude: 76.9558, popularAreas: ['Gandhipuram', 'RS Puram', 'Peelamedu', 'Saibaba Colony', 'Singanallur', 'Saravanampatti', 'Ukkadam', 'Kovaipudur', 'Ganapathy', 'Vadavalli', 'Thudiyalur', 'Sulur'] },
          { name: 'Madurai', latitude: 9.9252, longitude: 78.1198, popularAreas: ['Meenakshi Amman Kovil Area', 'KK Nagar', 'Anna Nagar', 'Tallakulam', 'Simmakkal', 'Goripalayam', 'Villapuram', 'Tirunagar', 'Teppakulam', 'Mattuthavani', 'Arapalayam'] },
          { name: 'Tiruchirappalli (Trichy)', latitude: 10.7905, longitude: 78.7047, popularAreas: ['Srirangam', 'Thillai Nagar', 'K.K. Nagar', 'Cantonment', 'Rockfort', 'Ponmalai (Golden Rock)', 'Woraiyur', 'Palakkarai', 'Kattur', 'Thuvakudi'] },
          { name: 'Salem', latitude: 11.6643, longitude: 78.1460, popularAreas: ['Fairlands', 'Alagapuram', 'Suramangalam', 'Hasthampatti', 'Shevapet', 'Ammapet', 'Kannankurichi', 'Kondalampatti', 'Omalur', 'Steel Plant'] },
          { name: 'Vellore', latitude: 12.9165, longitude: 79.1325, popularAreas: ['Katpadi', 'Sathuvachari', 'Bagayam', 'Thorapadi', 'Otteri', 'Gandhi Nagar', 'Shenbakkam', 'Rangapuram', 'Konavattam', 'Salavanpet'] },
          { name: 'Ranipet & Walajapet', latitude: 12.9281, longitude: 79.3331, popularAreas: ['Walajapet (Walajah)', 'Ranipet Town', 'Arcot', 'SIPCOT Ranipet', 'Melvisharam', 'Navlock', 'Vannivedu', 'Cheyyar Road'] },
          { name: 'Arcot', latitude: 12.9067, longitude: 79.3333, popularAreas: ['Arcot Town', 'Kalavai', 'Thimiri', 'Villaripalayam', 'Tajpura'] },
          { name: 'Tirupathur & Vaniyambadi', latitude: 12.4967, longitude: 78.5739, popularAreas: ['Tirupathur Town', 'Vaniyambadi', 'Ambur', 'Jolarpet', 'Natrampalli', 'Yelagiri Hills'] },
          { name: 'Kumbakonam', latitude: 10.9602, longitude: 79.3845, popularAreas: ['Mahamaham Tank Area', 'Uchisannadhi', 'Nageswaran Kovil', 'Darasuram', 'Swamimalai', 'Thirunageswaram', 'Patteswaram', 'Nachiyar Koil'] },
          { name: 'Thanjavur (Tanjore)', latitude: 10.7870, longitude: 79.1378, popularAreas: ['Brihadeeswarar Temple Area', 'Medical College Road', 'Saranathan Nagar', 'Vallam', 'Punnainallur Mariamman', 'Karanthai', 'Ramanathan', 'Nanjikottai'] },
          { name: 'Kanchipuram', latitude: 12.8342, longitude: 79.7036, popularAreas: ['Ekambareswarar Area', 'Varadharaja Perumal Area', 'Kamakshi Amman Area', 'Orikkai', 'Walajabad', 'Sriperumbudur', 'Uthiramerur'] },
          { name: 'Tirunelveli', latitude: 8.7139, longitude: 77.7567, popularAreas: ['Nellaiappar Temple Area', 'Palayamkottai', 'Vannarpettai', 'Tirunelveli Town', 'Melapalayam', 'Tirunelveli Junction', 'Thachanallur'] },
          { name: 'Erode', latitude: 11.3410, longitude: 77.7172, popularAreas: ['Perundurai', 'Gobichettipalayam', 'Bhavani', 'Solar', 'Thindal', 'Veerappanchatram', 'Surampatti', 'Sathyamangalam', 'Anthiyur'] },
          { name: 'Tiruppur', latitude: 11.1085, longitude: 77.3411, popularAreas: ['Avinashi', 'Palladam', 'Udumalaipettai', 'Dharapuram', 'Kangeyam', 'Veerapandi', 'Tiruppur Bazaar', 'Nallur'] },
          { name: 'Dindigul', latitude: 10.3673, longitude: 77.9803, popularAreas: ['Dindigul Fort Area', 'Palani', 'Kodaikanal', 'Natham', 'Vedasandur', 'Oddanchatram', 'Nilakottai', 'Batlagundu'] },
          { name: 'Cuddalore', latitude: 11.7480, longitude: 79.7714, popularAreas: ['Cuddalore Port', 'Tirupadiripulyur', 'Nellikuppam', 'Panruti', 'Vridhachalam', 'Chidambaram', 'Neyveli Township', 'Kattumannarkoil'] },
          { name: 'Chidambaram', latitude: 11.3992, longitude: 79.6936, popularAreas: ['Nataraja Temple Area', 'Annamalai University Campus', 'Bhuvanagiri', 'Porto Novo (Parangipettai)', 'Kattumannarkoil'] },
          { name: 'Tiruvannamalai', latitude: 12.2253, longitude: 79.0747, popularAreas: ['Girivalam Path', 'Annamalaiyar Temple Area', 'Ramana Ashram', 'Polur', 'Chengam', 'Arani', 'Cheyyar', 'Vandavasi'] },
          { name: 'Nagercoil (Kanyakumari)', latitude: 8.1833, longitude: 77.4119, popularAreas: ['Kanyakumari Beach', 'Nagercoil Town', 'Suchindram', 'Padmanabhapuram', 'Marthandam', 'Thuckalay', 'Colachel', 'Kuzhithurai'] },
          { name: 'Thoothukudi (Tuticorin)', latitude: 8.7642, longitude: 78.1348, popularAreas: ['Tuticorin Port', 'Tiruchendur Murugan Kovil', 'Kovilpatti', 'Ettayapuram', 'Kayalpattinam', 'Sathankulam', 'Srivaikuntam'] },
          { name: 'Karur', latitude: 10.9601, longitude: 78.0766, popularAreas: ['Karur Town', 'Thanthoni', 'Kulithalai', 'Aravakurichi', 'Pugalur', 'Velur', 'Vengamedu'] },
          { name: 'Namakkal', latitude: 11.2189, longitude: 78.1674, popularAreas: ['Namakkal Fort Area', 'Rasipuram', 'Tiruchengode', 'Paramathi Velur', 'Kolli Hills', 'Sendamangalam', 'Komarapalayam'] },
          { name: 'Pudukkottai', latitude: 10.3797, longitude: 78.8208, popularAreas: ['Pudukkottai Palace', 'Aranthangi', 'Illuppur', 'Viralimalai', 'Thirumayam', 'Avudaiyarkoil', 'Alangudi'] },
          { name: 'Sivaganga & Karaikudi', latitude: 9.8433, longitude: 78.4809, popularAreas: ['Karaikudi Town (Chettinad)', 'Sivaganga Town', 'Devakottai', 'Manamadurai', 'Tirupathur (Sivaganga)', 'Singampunari', 'Ilayangudi'] },
          { name: 'Virudhunagar & Sivakasi', latitude: 9.5872, longitude: 77.9514, popularAreas: ['Sivakasi Town', 'Virudhunagar Town', 'Rajapalayam', 'Srivilliputhur Andal Kovil', 'Aruppukkottai', 'Sattur', 'Watrap'] },
          { name: 'Ramanathapuram', latitude: 9.3639, longitude: 78.8395, popularAreas: ['Rameswaram Island', 'Ramanathapuram Town', 'Paramakudi', 'Kilakarai', 'Mandapam', 'Tiruvadanai', 'Mudukulathur'] },
          { name: 'Theni', latitude: 10.0104, longitude: 77.4768, popularAreas: ['Theni Allinagaram', 'Periyakulam', 'Bodinayakanur', 'Cumbum', 'Uthamapalayam', 'Andipatti', 'Chinnamanur'] },
          { name: 'Viluppuram', latitude: 11.9401, longitude: 79.4861, popularAreas: ['Viluppuram Town', 'Tindivanam', 'Gingee Fort', 'Kallakurichi', 'Ulundurpet', 'Marakkanam', 'Valavanur'] },
          { name: 'Krishnagiri & Hosur', latitude: 12.5186, longitude: 78.2137, popularAreas: ['Hosur Industrial Hub', 'Krishnagiri Town', 'Pochampalli', 'Denkanikottai', 'Bargur', 'Uthangarai', 'Rayakottai'] },
          { name: 'Dharmapuri', latitude: 12.1211, longitude: 78.1582, popularAreas: ['Dharmapuri Town', 'Harur', 'Palacode', 'Pennagaram', 'Hogenakkal Falls Area', 'Pappireddipatti', 'Karimangalam'] },
          { name: 'Nagapattinam & Mayiladuthurai', latitude: 10.7672, longitude: 79.8449, popularAreas: ['Mayiladuthurai', 'Nagapattinam Port', 'Velankanni', 'Nagore Dargah', 'Sirkazhi', 'Tharangambadi', 'Vedaranyam', 'Kizhavalavur'] },
          { name: 'Tiruvarur', latitude: 10.7725, longitude: 79.6365, popularAreas: ['Thyagaraja Temple Area', 'Mannargudi', 'Thiruthuraipoondi', 'Nannilam', 'Kudavasal', 'Valangaiman', 'Muthupet'] },
          { name: 'Perambalur & Ariyalur', latitude: 11.2342, longitude: 78.8817, popularAreas: ['Perambalur Town', 'Ariyalur', 'Jayankondam', 'Gangaikonda Cholapuram', 'Veppanthattai', 'Kunnam', 'Sendurai'] },
          { name: 'The Nilgiris (Ooty)', latitude: 11.4102, longitude: 76.6950, popularAreas: ['Udhagamandalam (Ooty)', 'Coonoor', 'Kotagiri', 'Gudalur', 'Wellington', 'Kundah', 'Aruvankadu'] },
          { name: 'Tenkasi', latitude: 8.9594, longitude: 77.3150, popularAreas: ['Kasi Viswanathar Temple Area', 'Courtallam (Kutralam)', 'Sankarankovil', 'Kadayanallur', 'Shenkottai', 'Alangulam', 'Puliyangudi'] },
          { name: 'Tiruvallur', latitude: 13.1437, longitude: 79.9083, popularAreas: ['Tiruvallur Town', 'Avadi', 'Poonamallee', 'Tiruttani Murugan Temple', 'Gummidipoondi', 'Ponneri', 'Minjur', 'Uthukkottai'] },
          { name: 'Chengalpattu', latitude: 12.6841, longitude: 79.9836, popularAreas: ['Chengalpattu Town', 'Tambaram', 'Pallavaram', 'Mahabalipuram (Mamallapuram)', 'Madurantakam', 'Cheyyur', 'Maraimalai Nagar', 'Kelambakkam'] }
        ]
      },
      {
        name: 'Puducherry (Pondicherry)',
        cities: [
          { name: 'Puducherry Town', latitude: 11.9416, longitude: 79.8083, popularAreas: ['White Town (French Quarter)', 'Heritage Town', 'Auroville', 'Lawspet', 'Muthialpet', 'Villianur', 'Ariyankuppam', 'Kalapet'] },
          { name: 'Karaikal', latitude: 10.9254, longitude: 79.8380, popularAreas: ['Karaikal Town', 'Thirunallar Saniswaran Kovil', 'Kottucherry', 'Nedungadu', 'Neravy', 'T.R. Pattinam'] },
          { name: 'Mahe', latitude: 11.7003, longitude: 75.5343, popularAreas: ['Mahe Town', 'Chalakkara', 'Pandakkal'] },
          { name: 'Yanam', latitude: 16.7329, longitude: 82.2177, popularAreas: ['Yanam Town', 'Guerempeta', 'Farampeta'] }
        ]
      },
      {
        name: 'Karnataka',
        cities: [
          { name: 'Bengaluru (Bangalore)', latitude: 12.9716, longitude: 77.5946, popularAreas: ['Indiranagar', 'Koramangala', 'Jayanagar', 'Whitefield', 'Electronic City', 'Malleshwaram', 'HSR Layout', 'JP Nagar', 'Rajajinagar', 'BTM Layout', 'Yelahanka', 'Hebbal', 'Basavanagudi', 'Banashankari', 'Marathahalli'] },
          { name: 'Mysuru (Mysore)', latitude: 12.2958, longitude: 76.6394, popularAreas: ['Gokulam', 'Jayalakshmipuram', 'Vontikoppal', 'Saraswathipuram', 'Chamundi Hill Area', 'Kuvempunagar', 'Hebbal', 'Vijayanagar'] },
          { name: 'Mangaluru (Mangalore)', latitude: 12.9141, longitude: 74.8560, popularAreas: ['Kodialbail', 'Kadri', 'Bejai', 'Surathkal', 'Ullal', 'Hampankatta', 'Urwa', 'Kankanady'] },
          { name: 'Hubballi-Dharwad', latitude: 15.3647, longitude: 75.1240, popularAreas: ['Vidyanagar', 'Gokul Road', 'Navanagar', 'Keshwapur', 'Dharwad Market', 'Saptapur'] },
          { name: 'Belagavi (Belgaum)', latitude: 15.8497, longitude: 74.4977, popularAreas: ['Tilakwadi', 'Camp', 'Udyambag', 'Khasbag', 'Shahapur'] },
          { name: 'Udupi', latitude: 13.3409, longitude: 74.7421, popularAreas: ['Krishna Matha Area', 'Manipal', 'Malpe', 'Kallianpur', 'Kundapura', 'Karkala'] },
          { name: 'Shivamogga (Shimoga)', latitude: 13.9299, longitude: 75.5681, popularAreas: ['Gandhi Bazaar', 'Vinobha Nagar', 'Gopala', 'Bhadravati', 'Sagara'] },
          { name: 'Tumakuru (Tumkur)', latitude: 13.3379, longitude: 77.1173, popularAreas: ['Siddaganga', 'Batawadi', 'Kyathsandra', 'Kunigal', 'Tiptur', 'Sira'] },
          { name: 'Kalaburagi (Gulbarga)', latitude: 17.3297, longitude: 76.8343, popularAreas: ['Sedam Road', 'Super Market', 'MSK Mill Area', 'Brahmpur', 'Afzalpur'] },
          { name: 'Ballari (Bellary)', latitude: 15.1394, longitude: 76.9214, popularAreas: ['Cantonment', 'Gandhi Nagar', 'Cowlbazaar', 'Siruguppa', 'Hospet (Vijayanagara)'] },
          { name: 'Davanagere', latitude: 14.4644, longitude: 75.9218, popularAreas: ['MCC A Block', 'MCC B Block', 'Vidyanagar', 'Harihar', 'Channagiri'] },
          { name: 'Hassan', latitude: 13.0033, longitude: 76.1004, popularAreas: ['Vidya Nagar', 'Shankar Mutt', 'Belur', 'Halebidu', 'Sakleshpur', 'Channarayapatna', 'Shravanabelagola'] }
        ]
      },
      {
        name: 'Andhra Pradesh',
        cities: [
          { name: 'Visakhapatnam (Vizag)', latitude: 17.6868, longitude: 83.2185, popularAreas: ['MVP Colony', 'Beach Road', 'Gajuwaka', 'Madhurawada', 'Dwaraka Nagar', 'Siripuram', 'Rushikonda', 'Pendurthi'] },
          { name: 'Vijayawada', latitude: 16.5062, longitude: 80.6480, popularAreas: ['Benz Circle', 'Kanaka Durga Temple Area', 'MGM Road', 'Bhavanipuram', 'Gollapudi', 'Patamata', 'Governorpet'] },
          { name: 'Tirupati & Chittoor', latitude: 13.6288, longitude: 79.4192, popularAreas: ['Tirumala Temple Hills', 'Alipiri', 'Renigunta', 'Chandragiri', 'Chittoor Town', 'Srikalahasti', 'Madanapalle', 'Kuppam', 'Nagari'] },
          { name: 'Guntur', latitude: 16.3067, longitude: 80.4365, popularAreas: ['Brodipet', 'Arundelpet', 'Laxmipuram', 'Pattabhipuram', 'Tenali', 'Narasaraopet', 'Amaravati', 'Bapatla'] },
          { name: 'Nellore', latitude: 14.4426, longitude: 79.9865, popularAreas: ['Gandhi Nagar', 'Magunta Layout', 'Vedayapalem', 'Dargamitta', 'Gudur', 'Kavali', 'Venkatagiri', 'Sullurpeta (Sriharikota)'] },
          { name: 'Kurnool', latitude: 15.8281, longitude: 78.0373, popularAreas: ['Nandyal Road', 'Collectorate Area', 'Nandyal', 'Adoni', 'Yemmiganur', 'Srisailam Temple Area', 'Dhone'] },
          { name: 'Rajahmundry (Rajamahendravaram)', latitude: 17.0005, longitude: 81.8040, popularAreas: ['Godavari River Front', 'Danavaipeta', 'Aryapuram', 'Kateru', 'Kakinada', 'Amalapuram', 'Rampachodavaram'] },
          { name: 'Kakinada', latitude: 16.9891, longitude: 82.2475, popularAreas: ['Suryaraopeta', 'Bhanugudi', 'Madhavapatnam', 'Samalkot', 'Pithapuram', 'Annavaram Temple Area'] },
          { name: 'Anantapur', latitude: 14.6819, longitude: 77.6006, popularAreas: ['Clock Tower Area', 'Housing Board', 'Puttaparthi (Prasanthi Nilayam)', 'Dharmavaram', 'Hindupur', 'Guntakal', 'Tadipatri', 'Kadiri'] },
          { name: 'Kadapa (Cuddapah)', latitude: 14.4673, longitude: 78.8242, popularAreas: ['Nagarajupalle', 'Yerramukkapalle', 'Proddatur', 'Rayachoti', 'Pulivendula', 'Jammalamadugu', 'Badvel'] },
          { name: 'Eluru', latitude: 16.7107, longitude: 81.0952, popularAreas: ['Powerpet', 'Tangellamudi', 'Bhimavaram', 'Palakollu', 'Tanuku', 'Tadepalligudem', 'Jangareddigudem'] },
          { name: 'Ongole', latitude: 15.5057, longitude: 80.0499, popularAreas: ['Lawyerpet', 'Kurnool Road', 'Chirala', 'Kandukur', 'Markapur', 'Giddalur', 'Addanki'] },
          { name: 'Srikakulam & Vizianagaram', latitude: 18.2949, longitude: 83.8938, popularAreas: ['Srikakulam Town', 'Vizianagaram Fort Area', 'Bobbili', 'Salur', 'Amadalavalasa', 'Palasa', 'Tekkali'] }
        ]
      },
      {
        name: 'Telangana',
        cities: [
          { name: 'Hyderabad & Secunderabad', latitude: 17.3850, longitude: 78.4867, popularAreas: ['Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'HITEC City', 'Madhapur', 'Kukatpally', 'Secunderabad', 'Ameerpet', 'Begumpet', 'Dilsukhnagar', 'Charminar Area', 'Kondapur', 'Miyapur', 'LB Nagar', 'Uppal', 'Manikonda'] },
          { name: 'Warangal & Hanamkonda', latitude: 17.9689, longitude: 79.5941, popularAreas: ['Thousand Pillar Temple Area', 'Hanamkonda', 'Kazipet', 'Subedari', 'Narsampet', 'Jangaon', 'Mahabubabad'] },
          { name: 'Nizamabad', latitude: 18.6725, longitude: 78.0941, popularAreas: ['Khaleelwadi', 'Bodhan', 'Armoor', 'Kamareddy', 'Banswada'] },
          { name: 'Karimnagar', latitude: 18.4386, longitude: 79.1288, popularAreas: ['Mukarampura', 'Kothirampur', 'Ramagundam', 'Godavarikhani', 'Jagtial', 'Sircilla', 'Peddapalli'] },
          { name: 'Khammam', latitude: 17.2473, longitude: 80.1514, popularAreas: ['Wyra Road', 'Kothagudem', 'Bhadrachalam Temple Area', 'Palwancha', 'Yellandu', 'Sathupalli'] },
          { name: 'Mahabubnagar', latitude: 16.7488, longitude: 77.9863, popularAreas: ['Pillalamarri Road', 'Jadcherla', 'Nagarkurnool', 'Wanaparthy', 'Gadwal', 'Narayanpet', 'Shadnagar'] },
          { name: 'Nalgonda', latitude: 17.0575, longitude: 79.2684, popularAreas: ['Clock Tower Area', 'Suryapet', 'Miryalaguda', 'Yadagirigutta Temple Area', 'Bhongir (Bhuvanagiri)', 'Kodad'] }
        ]
      },
      {
        name: 'Kerala',
        cities: [
          { name: 'Thiruvananthapuram (Trivandrum)', latitude: 8.5241, longitude: 76.9366, popularAreas: ['Padmanabhaswamy Temple Area', 'Kowdiar', 'Pattom', 'Vellayambalam', 'Technopark (Kazhakoottam)', 'Statue', 'Varkala', 'Attingal', 'Neyyattinkara', 'Kovalam'] },
          { name: 'Kochi (Cochin)', latitude: 9.9312, longitude: 76.2673, popularAreas: ['Fort Kochi', 'Marine Drive', 'Kakkanad (Infopark)', 'Edappally', 'Kaloor', 'Panampilly Nagar', 'Aluva', 'Palarivattom', 'Vyttila', 'Tripunithura', 'Mattancherry'] },
          { name: 'Kozhikode (Calicut)', latitude: 11.2588, longitude: 75.7804, popularAreas: ['Mavoor Road', 'Beach Road', 'Mananchira', 'Nadakkavu', 'Palayam', 'Feroke', 'Koyilandy', 'Vadakara'] },
          { name: 'Thrissur', latitude: 10.5276, longitude: 76.2144, popularAreas: ['Vadakkunnathan Temple Area', 'Round North', 'Guruvayur Temple Area', 'Punkunnam', 'Ayyanthole', 'Irinjalakuda', 'Chalakudy', 'Kodungallur'] },
          { name: 'Kollam (Quilon)', latitude: 8.8932, longitude: 76.6141, popularAreas: ['Chinnakada', 'Asramam', 'Kottarakkara', 'Punalur', 'Karunagappalli', 'Paravur'] },
          { name: 'Palakkad (Palghat)', latitude: 10.7867, longitude: 76.6548, popularAreas: ['Fort Maidan', 'Kalpathy Heritage Village', 'Chittur', 'Ottapalam', 'Shoranur', 'Mannarkkad', 'Alathur', 'Pattambi'] },
          { name: 'Alappuzha (Alleppey)', latitude: 9.4981, longitude: 76.3388, popularAreas: ['Boat Jetty Area', 'Alappuzha Beach', 'Cherthala', 'Kayamkulam', 'Mavelikkara', 'Chengannur', 'Ambalapuzha'] },
          { name: 'Kottayam', latitude: 9.5916, longitude: 76.5222, popularAreas: ['Collectorate Area', 'Kanjirappally', 'Changanassery', 'Pala', 'Vaikom', 'Ettumanoor'] },
          { name: 'Kannur (Cannanore)', latitude: 11.8745, longitude: 75.3704, popularAreas: ['Payyambalam', 'Thalassery (Tellicherry)', 'Payyanur', 'Taliparamba', 'Mattannur'] },
          { name: 'Malappuram', latitude: 11.0735, longitude: 76.0740, popularAreas: ['Manjeri', 'Perinthalmanna', 'Tirur', 'Ponnani', 'Kottakkal Arya Vaidya Sala', 'Nilambur'] },
          { name: 'Pathanamthitta', latitude: 9.2648, longitude: 76.7870, popularAreas: ['Sabarimala Sannidhanam Base', 'Adoor', 'Thiruvalla', 'Ranni', 'Kozhencherry', 'Konni'] },
          { name: 'Kasaragod', latitude: 12.5102, longitude: 74.9852, popularAreas: ['Bekal Fort Area', 'Kanhangad', 'Nileshwar', 'Uppala', 'Manjeshwar'] },
          { name: 'Idukki & Wayanad', latitude: 9.8495, longitude: 76.9806, popularAreas: ['Munnar Hills', 'Thodupuzha', 'Kalpetta', 'Sulthan Bathery', 'Mananthavady', 'Kattappana'] }
        ]
      },
      {
        name: 'Maharashtra',
        cities: [
          { name: 'Mumbai', latitude: 19.0760, longitude: 72.8777, popularAreas: ['South Mumbai (Colaba, Nariman Pt)', 'Bandra', 'Andheri', 'Juhu', 'Borivali', 'Dadar', 'Goregaon', 'Powai', 'Chembur', 'Ghatkopar', 'Mulund', 'Kandivali', 'Malad', 'Santacruz', 'Kurla'] },
          { name: 'Thane & Navi Mumbai', latitude: 19.2183, longitude: 72.9781, popularAreas: ['Thane West', 'Ghodbunder Road', 'Vashi', 'Nerul', 'Kharghar', 'Panvel', 'Belapur', 'Airoli', 'Kalyan', 'Dombivli', 'Ulhasnagar', 'Mira-Bhayandar'] },
          { name: 'Pune', latitude: 18.5204, longitude: 73.8567, popularAreas: ['Kothrud', 'Aundh', 'Baner', 'Viman Nagar', 'Koregaon Park', 'Hinjewadi IT Park', 'Wakad', 'Hadapsar (Magarpatta)', 'Shivajinagar', 'Kalyani Nagar', 'Pimpri-Chinchwad', 'Deccan Gymkhana'] },
          { name: 'Nagpur', latitude: 21.1458, longitude: 79.0882, popularAreas: ['Dharampeth', 'Civil Lines', 'Ramdaspeth', 'Sitabuldi', 'Manish Nagar', 'Wardha Road', 'Kamptee'] },
          { name: 'Nashik', latitude: 19.9975, longitude: 73.7898, popularAreas: ['Panchavati (Godavari Ghats)', 'Gangapur Road', 'College Road', 'Indira Nagar', 'Trimbakeshwar Temple Area', 'Deolali', 'Satpur'] },
          { name: 'Chhatrapati Sambhajinagar (Aurangabad)', latitude: 19.8762, longitude: 75.3433, popularAreas: ['Cidco', 'Garkheda', 'Samarth Nagar', 'Ellora / Grishneshwar Area', 'Ajanta Base', 'Jalna'] },
          { name: 'Solapur', latitude: 17.6599, longitude: 75.9064, popularAreas: ['Siddheshwar Temple Area', 'Jule Solapur', 'Hotgi Road', 'Pandharpur Temple Area', 'Barshi', 'Akkalkot Swami Samarth Area'] },
          { name: 'Kolhapur', latitude: 16.7050, longitude: 74.2433, popularAreas: ['Mahalakshmi Temple Area', 'Tarabai Park', 'Rajarampuri', 'Nagala Park', 'Ichalkaranji', 'Jaysingpur', 'Kagal'] }
        ]
      },
      {
        name: 'Delhi NCR',
        cities: [
          { name: 'New Delhi & Central Delhi', latitude: 28.6139, longitude: 77.2090, popularAreas: ['Connaught Place', 'Chanakyapuri', 'Lajpat Nagar', 'South Extension', 'Hauz Khas', 'Greater Kailash', 'Saket', 'Dwarka', 'Rohini', 'Janakpuri', 'Karol Bagh', 'Chandni Chowk', 'Vasant Kunj', 'Pitampura', 'Mayur Vihar'] },
          { name: 'Noida & Greater Noida', latitude: 28.5355, longitude: 77.3910, popularAreas: ['Sector 18', 'Sector 62', 'Sector 137', 'Sector 150', 'Greater Noida West (Noida Extension)', 'Pari Chowk', 'Yamuna Expressway'] },
          { name: 'Gurugram (Gurgaon)', latitude: 28.4595, longitude: 77.0266, popularAreas: ['DLF Phase 1-5', 'Cyber City', 'Golf Course Road', 'Sohna Road', 'Sector 56', 'Sector 48', 'Palam Vihar', 'Manesar'] },
          { name: 'Faridabad & Ghaziabad', latitude: 28.4089, longitude: 77.3178, popularAreas: ['Indirapuram', 'Vaishali', 'Raj Nagar Extension', 'Vasundhara', 'Crossings Republik', 'Faridabad Sector 15', 'NIT Faridabad'] }
        ]
      },
      {
        name: 'Gujarat',
        cities: [
          { name: 'Ahmedabad', latitude: 23.0225, longitude: 72.5714, popularAreas: ['Navrangpura', 'Satellite', 'Bodakdev', 'SG Highway', 'Vastrapur', 'Prahlad Nagar', 'Maninagar', 'Chandkheda', 'Bopal', 'Ghatlodiya'] },
          { name: 'Gandhinagar', latitude: 23.2156, longitude: 72.6369, popularAreas: ['Sector 1-30', 'Infocity', 'GIFT City', 'Kudasan', 'Randesan', 'Sargasan', 'Vavol'] },
          { name: 'Surat', latitude: 21.1702, longitude: 72.8311, popularAreas: ['Athwa Lines', 'Adajan', 'Vesu', 'Piplod', 'Varachha', 'Katargam', 'Rander', 'Pal', 'Dumas'] },
          { name: 'Vadodara (Baroda)', latitude: 22.3072, longitude: 73.1812, popularAreas: ['Alkapuri', 'Akota', 'Gotri', 'Manjalpur', 'Vasna', 'Karelibaug', 'Fatehgunj', 'Sayajigunj'] },
          { name: 'Rajkot', latitude: 22.3039, longitude: 70.8022, popularAreas: ['Kalawad Road', 'Yagnik Road', 'University Road', '150 Feet Ring Road', 'Kothariya', 'Mavdi'] },
          { name: 'Bhavnagar, Jamnagar & Junagadh', latitude: 21.7645, longitude: 72.1519, popularAreas: ['Bhavnagar', 'Jamnagar', 'Junagadh (Girnar)', 'Somnath Temple Area', 'Dwarka Temple Area', 'Porbandar', 'Bhuj (Kutch)', 'Gandhidham', 'Morbi'] }
        ]
      },
      {
        name: 'Uttar Pradesh',
        cities: [
          { name: 'Varanasi (Kashi / Banaras)', latitude: 25.3176, longitude: 82.9739, popularAreas: ['Kashi Vishwanath Temple Area', 'Dashashwamedh Ghat', 'Assi Ghat', 'Lanka (BHU)', 'Godowlia', 'Sigra', 'Mahmoorganj', 'Bhojubir', 'Sarnath', 'Shivpur', 'Cantt'] },
          { name: 'Lucknow', latitude: 26.8467, longitude: 80.9462, popularAreas: ['Gomti Nagar', 'Hazratganj', 'Aliganj', 'Indira Nagar', 'Mahanagar', 'Alambagh', 'Jankipuram', 'Vikas Nagar', 'Chowk'] },
          { name: 'Prayagraj (Allahabad)', latitude: 25.4358, longitude: 81.8463, popularAreas: ['Triveni Sangam Area', 'Civil Lines', 'Georgetown', 'Katra', 'Tagore Town', 'Allahapur', 'Naini', 'Jhunsi', 'Phaphamau'] },
          { name: 'Ayodhya & Faizabad', latitude: 26.7922, longitude: 82.1998, popularAreas: ['Ram Janmabhoomi Temple Area', 'Hanuman Garhi', 'Naya Ghat', 'Civil Lines Faizabad', 'Rikabganj', 'Devkali'] },
          { name: 'Mathura & Vrindavan', latitude: 27.4924, longitude: 77.6737, popularAreas: ['Krishna Janmabhoomi Area', 'Vrindavan Banke Bihari', 'Govardhan Hill Area', 'Barsana', 'Radha Kund', 'Chhatikara Road'] },
          { name: 'Kanpur', latitude: 26.4499, longitude: 80.3319, popularAreas: ['Civil Lines', 'Swaroop Nagar', 'Kakadeo', 'Govind Nagar', 'Kidwai Nagar', 'Shyam Nagar', 'Kalyanpur'] },
          { name: 'Agra', latitude: 27.1767, longitude: 78.0081, popularAreas: ['Tajganj', 'Sanjay Place', 'Civil Lines', 'Dayalbagh', 'Kamla Nagar', 'Fatehabad Road', 'Sikandra'] },
          { name: 'Gorakhpur, Meerut, Bareilly & Aligarh', latitude: 26.7606, longitude: 83.3732, popularAreas: ['Gorakhpur (Gorakhnath Temple)', 'Meerut', 'Bareilly', 'Aligarh', 'Jhansi', 'Moradabad', 'Saharanpur'] }
        ]
      },
      {
        name: 'West Bengal',
        cities: [
          { name: 'Kolkata (Calcutta)', latitude: 22.5726, longitude: 88.3639, popularAreas: ['Salt Lake (Bidhannagar)', 'New Town', 'Ballygunge', 'Alipore', 'Park Street', 'Kalighat Kali Temple Area', 'Dakshineswar Kali Temple', 'Dum Dum', 'Garia', 'Jadavpur', 'Behala', 'Howrah'] },
          { name: 'Siliguri & Darjeeling', latitude: 26.7271, longitude: 88.3953, popularAreas: ['Siliguri Town', 'Darjeeling Mall', 'Kalimpong', 'Kurseong', 'Sevoke Road', 'Matigara'] },
          { name: 'Durgapur & Asansol', latitude: 23.5204, longitude: 87.3119, popularAreas: ['City Centre Durgapur', 'Benachity', 'Asansol Town', 'Raniganj', 'Kulti', 'Burnpur'] }
        ]
      },
      {
        name: 'Rajasthan',
        cities: [
          { name: 'Jaipur', latitude: 26.9124, longitude: 75.7873, popularAreas: ['Vaishali Nagar', 'Malviya Nagar', 'Mansarovar', 'C-Scheme', 'Bani Park', 'Raja Park', 'Tonk Road', 'Jagatpura', 'Amer'] },
          { name: 'Jodhpur', latitude: 26.2389, longitude: 73.0243, popularAreas: ['Shastri Nagar', 'Ratanada', 'Sardarpura', 'Paota', 'Pal Road', 'Mandore'] },
          { name: 'Udaipur', latitude: 24.5854, longitude: 73.7125, popularAreas: ['Fateh Sagar Area', 'Panchwati', 'Hiran Magri', 'Sukher', 'Shobhagpura', 'Bhubhneshwar'] },
          { name: 'Kota, Ajmer, Pushkar & Bikaner', latitude: 26.4499, longitude: 74.6399, popularAreas: ['Ajmer Sharif', 'Pushkar Brahma Temple', 'Kota Vigyan Nagar', 'Bikaner Kote Gate', 'Alwar', 'Bhilwara', 'Chittorgarh', 'Sikar'] }
        ]
      },
      {
        name: 'Punjab & Haryana & Chandigarh',
        cities: [
          { name: 'Chandigarh Tri-City', latitude: 30.7333, longitude: 76.7794, popularAreas: ['Sector 17', 'Sector 35', 'Sector 22', 'Mohali (SAS Nagar)', 'Panchkula', 'Zirakpur', 'Kharar'] },
          { name: 'Amritsar', latitude: 31.6340, longitude: 74.8723, popularAreas: ['Golden Temple Area', 'Ranjit Avenue', 'Lawrence Road', 'Mall Road', 'Civil Lines', 'Majitha Road'] },
          { name: 'Ludhiana & Jalandhar', latitude: 30.9010, longitude: 75.8573, popularAreas: ['Model Town Ludhiana', 'Sarabha Nagar', 'Model Town Jalandhar', 'Civil Lines', 'Phagwara', 'Patiala', 'Bathinda'] }
        ]
      },
      {
        name: 'Madhya Pradesh & Chhattisgarh',
        cities: [
          { name: 'Indore', latitude: 22.7196, longitude: 75.8577, popularAreas: ['Vijay Nagar', 'Palasia', 'Saket', 'Geeta Bhavan', 'Rau', 'Annapurna', 'Rajwada'] },
          { name: 'Bhopal', latitude: 23.2599, longitude: 77.4126, popularAreas: ['Arera Colony', 'MP Nagar', 'Kolar Road', 'Shahpura', 'TT Nagar', 'Hoshangabad Road'] },
          { name: 'Ujjain (Mahakaleshwar)', latitude: 23.1765, longitude: 75.7885, popularAreas: ['Mahakaleshwar Jyotirlinga Area', 'Ram Ghat', 'Freeganj', 'Kal Bhairav Area', 'Kothi Road'] },
          { name: 'Gwalior, Jabalpur & Raipur', latitude: 26.2183, longitude: 78.1828, popularAreas: ['Gwalior Fort Area', 'Jabalpur Civil Lines', 'Raipur Telibandha', 'Bhilai', 'Bilaspur', 'Rewa', 'Satna'] }
        ]
      },
      {
        name: 'Odisha, Bihar, Jharkhand, Assam & North East',
        cities: [
          { name: 'Bhubaneswar & Puri', latitude: 20.2961, longitude: 85.8245, popularAreas: ['Jagannath Temple Puri', 'Saheed Nagar', 'Nayapalli', 'Patia (KIIT)', 'Jayadev Vihar', 'Cuttack Link Road', 'Konark Sun Temple Area'] },
          { name: 'Patna & Gaya', latitude: 25.5941, longitude: 85.1376, popularAreas: ['Boring Road', 'Kankarbagh', 'Bailey Road', 'Bodh Gaya Mahabodhi Temple', 'Vishnupad Temple Gaya', 'Muzaffarpur', 'Bhagalpur'] },
          { name: 'Ranchi & Jamshedpur', latitude: 23.3441, longitude: 85.3096, popularAreas: ['Harmu Housing', 'Bistupur Jamshedpur', 'Kadma', 'Sakchi', 'Dhanbad', 'Deoghar Baidyanath Dham', 'Bokaro'] },
          { name: 'Guwahati & North East', latitude: 26.1445, longitude: 91.7362, popularAreas: ['Kamakhya Temple Area', 'GS Road', 'Dispur', 'Zoo Road', 'Paltan Bazaar', 'Shillong (Meghalaya)', 'Imphal', 'Agartala', 'Gangtok'] }
        ]
      },
      {
        name: 'Uttarakhand & Himachal Pradesh',
        cities: [
          { name: 'Haridwar & Rishikesh', latitude: 29.9457, longitude: 78.1642, popularAreas: ['Har Ki Pauri', 'Kankhal', 'Shivalik Nagar', 'Triveni Ghat Rishikesh', 'Tapovan', 'Laxman Jhula Area', 'Swarg Ashram'] },
          { name: 'Dehradun & Mussoorie', latitude: 30.3165, longitude: 78.0322, popularAreas: ['Rajpur Road', 'Jakhan', 'Vasant Vihar', 'Clement Town', 'Mall Road Mussoorie', 'Vikas Nagar'] },
          { name: 'Shimla, Kullu & Manali', latitude: 31.1048, longitude: 77.1734, popularAreas: ['Mall Road Shimla', 'Sanjauli', 'Manali Mall', 'Old Manali', 'Dharamshala', 'McLeod Ganj', 'Mandi', 'Solan'] }
        ]
      },
      {
        name: 'Goa',
        cities: [
          { name: 'North Goa', latitude: 15.4909, longitude: 73.8278, popularAreas: ['Panaji (Panjim)', 'Mapusa', 'Calangute', 'Candolim', 'Porvorim', 'Bicholim', 'Pernem'] },
          { name: 'South Goa', latitude: 15.2832, longitude: 73.9862, popularAreas: ['Margao (Madgaon)', 'Vasco da Gama', 'Ponda (Temples Area)', 'Fatorda', 'Curchorem', 'Canacona'] }
        ]
      }
    ]
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    timezoneOffsetHours: 5.5,
    states: [
      {
        name: 'Western Province',
        cities: [
          { name: 'Colombo', latitude: 6.9271, longitude: 79.8612, popularAreas: ['Colombo 06 (Wellawatte)', 'Colombo 04 (Bambalapitiya)', 'Colombo 11 (Pettah - Hindu Kovils)', 'Colombo 03 (Kollupitiya)', 'Colombo 05 (Havelock Town)', 'Dehiwala', 'Mount Lavinia', 'Moratuwa', 'Kotte', 'Nugegoda', 'Maharagama', 'Homagama'] },
          { name: 'Gampaha', latitude: 7.0840, longitude: 79.9939, popularAreas: ['Negombo (Sea Street)', 'Wattala', 'Ja-Ela', 'Kelaniya', 'Kadawatha', 'Kiribathgoda', 'Minuwangoda', 'Mirigama'] },
          { name: 'Kalutara', latitude: 6.5854, longitude: 79.9607, popularAreas: ['Kalutara South', 'Panadura', 'Horana', 'Beruwala', 'Aluthgama', 'Matugama'] }
        ]
      },
      {
        name: 'Northern Province',
        cities: [
          { name: 'Jaffna (யாழ்ப்பாணம்)', latitude: 9.6615, longitude: 80.0255, popularAreas: ['Nallur (Kandaswamy Kovil)', 'Jaffna Town', 'Chunnakam', 'Kopay', 'Manipay', 'Chavakachcheri', 'Point Pedro (பருத்தித்துறை)', 'Karainagar', 'Velanai', 'Tellippalai', 'Valvettithurai', 'Kaithady', 'Inuvil', 'Mallakam', 'Achchuveli'] },
          { name: 'Kilinochchi & Mannar', latitude: 9.3803, longitude: 80.3770, popularAreas: ['Kilinochchi Town', 'Paranthan', 'Poonakary', 'Mannar Town', 'Thiruketheeswaram Kovil Area', 'Talaimannar', 'Nanaddan'] },
          { name: 'Vavuniya & Mullaitivu', latitude: 8.7514, longitude: 80.4971, popularAreas: ['Vavuniya Town', 'Cheddikulam', 'Nedunkeni', 'Mullaitivu Town', 'Puthukkudiyiruppu', 'Mankulam'] }
        ]
      },
      {
        name: 'Eastern Province',
        cities: [
          { name: 'Batticaloa (மட்டக்களப்பு)', latitude: 7.7310, longitude: 81.6747, popularAreas: ['Batticaloa Town', 'Kallady', 'Kattankudy', 'Eravur', 'Kaluwanchikudy', 'Valaichchenai', 'Chenkalady', 'Oddamavadi', 'Vellavely', 'Kokkadichcholai'] },
          { name: 'Trincomalee (திருகோணமலை)', latitude: 8.5874, longitude: 81.2152, popularAreas: ['Koneswaram Temple Area', 'Trincomalee Town', 'Kinniya', 'Muttur', 'Nilaveli', 'Kantale', 'Sampoor', 'Kuchchaveli', 'Thampalakamam'] },
          { name: 'Ampara & Kalmunai', latitude: 7.2912, longitude: 81.6724, popularAreas: ['Kalmunai', 'Karaitivu', 'Akkaraipattu', 'Sammanthurai', 'Thirukkovil', 'Ampara Town', 'Pottuvil'] }
        ]
      },
      {
        name: 'Central & Hill Country',
        cities: [
          { name: 'Kandy (கண்டி)', latitude: 7.2906, longitude: 80.6337, popularAreas: ['Kandy City', 'Peradeniya', 'Katugastota', 'Gampola', 'Akurana', 'Kadugannawa', 'Kundasale'] },
          { name: 'Nuwara Eliya & Hatton', latitude: 6.9497, longitude: 80.7891, popularAreas: ['Nuwara Eliya Town', 'Hatton', 'Maskeliya (Sripada Base)', 'Talawakelle', 'Norwood', 'Bogawantalawa', 'Kotagala', 'Nanu Oya', 'Ragala'] },
          { name: 'Matale & Badulla', latitude: 7.4675, longitude: 80.6234, popularAreas: ['Matale (Muthumariamman Kovil)', 'Dambulla', 'Badulla Town', 'Bandarawela', 'Ella', 'Haputale', 'Welimada', 'Mahiyanganaya'] }
        ]
      },
      {
        name: 'Southern & North Western',
        cities: [
          { name: 'Galle & Matara', latitude: 6.0535, longitude: 80.2210, popularAreas: ['Galle Fort', 'Karapitiya', 'Hikkaduwa', 'Matara Town', 'Weligama', 'Kataragama Temple Area', 'Hambantota'] },
          { name: 'Kurunegala & Puttalam', latitude: 7.4863, longitude: 80.3623, popularAreas: ['Kurunegala Town', 'Kuliyapitiya', 'Puttalam Town', 'Chilaw (Munneswaram Kovil)', 'Marawila'] },
          { name: 'Anuradhapura & Ratnapura', latitude: 8.3114, longitude: 80.4037, popularAreas: ['Anuradhapura Sacred City', 'Polonnaruwa', 'Ratnapura Gem City', 'Kegalle', 'Mawanella'] }
        ]
      }
    ]
  },
  {
    code: 'MY',
    name: 'Malaysia',
    timezoneOffsetHours: 8.0,
    states: [
      {
        name: 'Selangor & Kuala Lumpur',
        cities: [
          { name: 'Kuala Lumpur', latitude: 3.1390, longitude: 101.6869, popularAreas: ['Brickfields (Little India)', 'Batu Caves Area', 'Bukit Bintang', 'Bangsar', 'Cheras', 'Kepong', 'Setapak', 'Sentul', 'Mont Kiara', 'Sri Petaling', 'Wangsa Maju'] },
          { name: 'Petaling Jaya & Subang Jaya', latitude: 3.1073, longitude: 101.6067, popularAreas: ['PJ Old Town', 'SS2', 'Damansara', 'Kelana Jaya', 'Bandar Sunway', 'USJ Subang', 'SS15', 'Kota Damansara', 'Puchong'] },
          { name: 'Klang & Shah Alam', latitude: 3.0449, longitude: 101.4456, popularAreas: ['Little India Klang (Jalan Tengku Kelana)', 'Taman Sri Andalas', 'Bukit Tinggi', 'Kapar', 'Meru', 'Shah Alam Section 7', 'Kota Kemuning', 'Setia Alam'] },
          { name: 'Kajang, Rawang & Banting', latitude: 2.9927, longitude: 101.7909, popularAreas: ['Kajang Town', 'Semenyih', 'Bangi', 'Rawang', 'Banting (Kuala Langat)', 'Sepang', 'Cyberjaya', 'Putrajaya', 'Ampang'] }
        ]
      },
      {
        name: 'Johor',
        cities: [
          { name: 'Johor Bahru', latitude: 1.4927, longitude: 103.7414, popularAreas: ['JB City Centre (Arulmigu Rajamariamman)', 'Taman Pelangi', 'Taman Universiti (Skudai)', 'Mount Austin', 'Bukit Indah', 'Tebrau', 'Iskandar Puteri', 'Pasir Gudang', 'Permas Jaya'] },
          { name: 'Batu Pahat & Muar', latitude: 1.8548, longitude: 102.9325, popularAreas: ['Batu Pahat Town', 'Muar Town', 'Kluang', 'Segamat', 'Kulai', 'Kota Tinggi', 'Pontian', 'Tangkak'] }
        ]
      },
      {
        name: 'Penang (Pulau Pinang)',
        cities: [
          { name: 'George Town & Penang Island', latitude: 5.4141, longitude: 100.3288, popularAreas: ['Little India (Lebuh Pasar)', 'Waterfall Arulmigu Balathandayuthapani', 'Bayan Lepas', 'Gelugor', 'Air Itam', 'Tanjung Tokong', 'Batu Ferringhi', 'Balik Pulau'] },
          { name: 'Seberang Perai (Mainland)', latitude: 5.3991, longitude: 100.4150, popularAreas: ['Butterworth', 'Bukit Mertajam', 'Perai', 'Nibong Tebal', 'Simpang Ampat', 'Kepala Batas', 'Jawi'] }
        ]
      },
      {
        name: 'Perak',
        cities: [
          { name: 'Ipoh', latitude: 4.5975, longitude: 101.0901, popularAreas: ['Kallumalai Murugan Kovil Area', 'Ipoh Old Town', 'Buntong', 'Gunung Rapat', 'Bercham', 'Menglembu', 'Falim', 'Tambun', 'Chemor'] },
          { name: 'Taiping, Teluk Intan & Sitiawan', latitude: 4.8500, longitude: 100.7333, popularAreas: ['Taiping Town', 'Teluk Intan', 'Sitiawan & Manjung', 'Batu Gajah', 'Kampar', 'Kuala Kangsar', 'Tapah', 'Sungai Siput', 'Tanjung Malim'] }
        ]
      },
      {
        name: 'Kedah, Negeri Sembilan, Melaka & Pahang',
        cities: [
          { name: 'Sungai Petani & Alor Setar', latitude: 5.6470, longitude: 100.4877, popularAreas: ['Sungai Petani Town', 'Alor Setar', 'Kulim High Tech', 'Langkawi Island', 'Bedong', 'Gurun', 'Baling'] },
          { name: 'Seremban & Nilai', latitude: 2.7258, longitude: 101.9424, popularAreas: ['Seremban Town', 'Senawang', 'Rasah', 'Nilai', 'Port Dickson', 'Bahau', 'Kuala Klawang'] },
          { name: 'Melaka (Malacca)', latitude: 2.1896, longitude: 102.2501, popularAreas: ['Melaka Town (Sri Poyyatha Kovil)', 'Ayer Keroh', 'Batu Berendam', 'Alor Gajah', 'Jasin', 'Bukit Beruang'] },
          { name: 'Kuantan & Cameron Highlands', latitude: 3.8077, longitude: 103.3260, popularAreas: ['Kuantan Town', 'Cameron Highlands (Tanah Rata, Brinchang)', 'Bentong', 'Raub', 'Temerloh', 'Mentakab'] }
        ]
      }
    ]
  },
  {
    code: 'SG',
    name: 'Singapore',
    timezoneOffsetHours: 8.0,
    states: [
      {
        name: 'Singapore Region',
        cities: [
          { name: 'Central Region', latitude: 1.290270, longitude: 103.851959, popularAreas: ['Little India (Serangoon Road)', 'Sri Srinivasa Perumal Kovil Area', 'Sri Veeramakaliamman Area', 'Chinatown (Sri Mariamman)', 'Tanjong Pagar', 'Orchard', 'Novena', 'Toa Payoh', 'Bishan', 'Queenstown', 'Bukit Merah'] },
          { name: 'East Region', latitude: 1.352083, longitude: 103.944710, popularAreas: ['Tampines', 'Bedok', 'Pasir Ris', 'Geylang Serai', 'Marine Parade', 'Kallang', 'Paya Lebar', 'Changi'] },
          { name: 'West Region', latitude: 1.352585, longitude: 103.697876, popularAreas: ['Jurong East', 'Jurong West', 'Clementi', 'Bukit Batok', 'Bukit Panjang', 'Choa Chu Kang', 'Tuas'] },
          { name: 'North & North-East Region', latitude: 1.438200, longitude: 103.789000, popularAreas: ['Woodlands', 'Yishun', 'Sembawang', 'Hougang', 'Sengkang', 'Punggol', 'Serangoon', 'Ang Mo Kio'] }
        ]
      }
    ]
  },
  {
    code: 'FJ',
    name: 'Fiji',
    timezoneOffsetHours: 12.0,
    states: [
      {
        name: 'Western Division (Viti Levu)',
        cities: [
          { name: 'Nadi', latitude: -17.8000, longitude: 177.4167, popularAreas: ['Sri Siva Subramaniya Swami Kovil Area', 'Nadi Town', 'Denarau Island', 'Namaka', 'Martintar', 'Votualevu', 'Sabeto', 'Navakai'] },
          { name: 'Lautoka (Sugar City)', latitude: -17.6167, longitude: 177.4500, popularAreas: ['Lautoka Town', 'Vitogo', 'Tavakubu', 'Waiyavi', 'Simla', 'Kashmir', 'Drasa'] },
          { name: 'Ba & Tavua', latitude: -17.5333, longitude: 177.6833, popularAreas: ['Ba Town', 'Varavu', 'Nailaga', 'Rarawai', 'Tavua Town', 'Gold Mine Vatukoula'] },
          { name: 'Sigatoka & Coral Coast', latitude: -18.1500, longitude: 177.5000, popularAreas: ['Sigatoka Town', 'Kulukulu', 'Olosara', 'Korotogo', 'Cuvu', 'Lawaqa'] },
          { name: 'Rakiraki (Ra)', latitude: -17.3667, longitude: 178.1500, popularAreas: ['Vaileka (Rakiraki Town)', 'Ellington Wharf', 'Nanuku', 'Penang Mill'] }
        ]
      },
      {
        name: 'Central Division (Viti Levu)',
        cities: [
          { name: 'Suva (Capital)', latitude: -18.1416, longitude: 178.4419, popularAreas: ['Suva City', 'Samabula', 'Raiwaqa', 'Lami', 'Tamavua', 'Nasinu', 'Domain', 'Flagstaff'] },
          { name: 'Nausori & Navua', latitude: -18.0333, longitude: 178.5333, popularAreas: ['Nausori Town', 'Koronivia', 'Davuilevu', 'Tailevu', 'Navua Town', 'Deuba (Pacific Harbour)'] }
        ]
      },
      {
        name: 'Northern & Eastern Division (Vanua Levu & Islands)',
        cities: [
          { name: 'Labasa (Vanua Levu)', latitude: -16.4333, longitude: 179.3667, popularAreas: ['Labasa Town', 'Nagigi Temple (Naag Mandir)', 'Vunika', 'Waiqele', 'Batinikama', 'Seaqaqa'] },
          { name: 'Savusavu & Taveuni', latitude: -16.7833, longitude: 179.3333, popularAreas: ['Savusavu Town', 'Naveria', 'Waiyevo (Taveuni)', 'Matei', 'Levuka (Ovalau)'] }
        ]
      }
    ]
  },
  {
    code: 'US',
    name: 'United States',
    timezoneOffsetHours: -5.0,
    states: [
      {
        name: 'California',
        cities: [
          { name: 'San Francisco Bay Area & Silicon Valley', latitude: 37.7749, longitude: -122.4194, popularAreas: ['San Jose', 'Sunnyvale', 'Fremont', 'Santa Clara', 'Cupertino', 'San Francisco', 'Oakland', 'Palo Alto', 'Mountain View', 'Milpitas', 'San Ramon', 'Dublin', 'Pleasanton', 'Berkeley'] },
          { name: 'Greater Los Angeles & Orange County', latitude: 34.0522, longitude: -118.2437, popularAreas: ['Los Angeles', 'Irvine', 'Artesia (Little India / Pioneer Blvd)', 'Malibu Temple Area (Calabasas)', 'Pasadena', 'Torrance', 'Anaheim', 'Long Beach', 'Glendale', 'Santa Monica', 'Burbank'] },
          { name: 'San Diego & Sacramento', latitude: 32.7157, longitude: -117.1611, popularAreas: ['San Diego (Mira Mesa)', 'La Jolla', 'Sacramento', 'Folsom', 'Roseville', 'Elk Grove', 'Bakersfield', 'Fresno'] }
        ]
      },
      {
        name: 'Texas',
        cities: [
          { name: 'Dallas - Fort Worth (DFW Metroplex)', latitude: 32.7767, longitude: -96.7970, popularAreas: ['Dallas', 'Plano', 'Frisco', 'Irving (Valley Ranch)', 'Coppell', 'Allen', 'McKinney', 'Fort Worth', 'Arlington', 'Garland', 'Richardson', 'Carrollton'] },
          { name: 'Houston Metro', latitude: 29.7604, longitude: -95.3698, popularAreas: ['Sugar Land', 'Katy', 'Pearland', 'Houston Downtown', 'The Woodlands', 'Cypress', 'Spring', 'Clear Lake', 'Richmond'] },
          { name: 'Austin & San Antonio', latitude: 30.2672, longitude: -97.7431, popularAreas: ['Austin Downtown', 'Round Rock', 'Cedar Park', 'Leander', 'San Antonio', 'San Marcos'] }
        ]
      },
      {
        name: 'New York & New Jersey',
        cities: [
          { name: 'New York City Metro', latitude: 40.7128, longitude: -74.0060, popularAreas: ['Manhattan', 'Queens (Flushing Ganesh Temple / Jackson Heights)', 'Brooklyn', 'Staten Island', 'Bronx', 'Long Island (Nassau/Suffolk)', 'White Plains', 'Albany', 'Buffalo'] },
          { name: 'New Jersey', latitude: 40.5187, longitude: -74.3474, popularAreas: ['Edison (Oak Tree Road / Little India)', 'Iselin', 'Jersey City (India Square)', 'Princeton', 'Parsippany', 'Woodbridge', 'Robbinsville (Akshardham)', 'Bridgewater', 'Newark', 'Hoboken', 'Cherry Hill'] }
        ]
      },
      {
        name: 'Washington, Illinois, Georgia & Florida',
        cities: [
          { name: 'Seattle & Greater Puget Sound (WA)', latitude: 47.6062, longitude: -122.3321, popularAreas: ['Seattle', 'Bellevue', 'Redmond', 'Kirkland', 'Sammamish', 'Bothell', 'Renton', 'Tacoma', 'Issaquah'] },
          { name: 'Chicago Metro (IL)', latitude: 41.8781, longitude: -87.6298, popularAreas: ['Chicago (Devon Ave)', 'Naperville', 'Schaumburg', 'Aurora', 'Hoffman Estates', 'Oak Brook', 'Buffalo Grove', 'Evanston'] },
          { name: 'Atlanta Metro (GA)', latitude: 33.7490, longitude: -84.3880, popularAreas: ['Atlanta', 'Alpharetta', 'Cumming', 'Duluth', 'Johns Creek', 'Suwanee', 'Marietta', 'Norcross', 'Lawrenceville', 'Riverdale (Hindu Temple of Atlanta)'] },
          { name: 'Florida (FL)', latitude: 25.7617, longitude: -80.1918, popularAreas: ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'West Palm Beach', 'Tallahassee', 'St. Petersburg'] }
        ]
      },
      {
        name: 'Virginia, Maryland, Massachusetts, Pennsylvania, NC, OH, MI, AZ',
        cities: [
          { name: 'Washington DC Metro (VA & MD)', latitude: 38.9072, longitude: -77.0369, popularAreas: ['Ashburn (VA)', 'Herndon (VA)', 'Fairfax (VA)', 'Reston (VA)', 'Richmond (VA)', 'Bethesda (MD)', 'Rockville (MD)', 'Silver Spring (MD)', 'Gaithersburg (MD)', 'Columbia (MD)'] },
          { name: 'Boston Metro (MA)', latitude: 42.3601, longitude: -71.0589, popularAreas: ['Boston', 'Cambridge', 'Shrewsbury', 'Waltham', 'Framingham', 'Newton', 'Lowell', 'Burlington', 'Worcester'] },
          { name: 'Philadelphia & Pittsburgh (PA)', latitude: 39.9526, longitude: -75.1652, popularAreas: ['Philadelphia', 'King of Prussia', 'Exton', 'Pittsburgh (Penn Hills SV Temple)', 'Allentown', 'Harrisburg'] },
          { name: 'Raleigh & Charlotte (NC)', latitude: 35.7796, longitude: -78.6382, popularAreas: ['Raleigh', 'Cary', 'Morrisville', 'Durham', 'Charlotte', 'Concord', 'Greensboro'] },
          { name: 'Ohio, Michigan & Arizona', latitude: 41.4993, longitude: -81.6944, popularAreas: ['Columbus (OH)', 'Cleveland (OH)', 'Cincinnati (OH)', 'Detroit (MI)', 'Troy (MI)', 'Ann Arbor (MI)', 'Novi (MI)', 'Phoenix (AZ)', 'Chandler (AZ)', 'Tempe (AZ)', 'Scottsdale (AZ)'] }
        ]
      }
    ]
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    timezoneOffsetHours: 0.0,
    states: [
      {
        name: 'Greater London & South East',
        cities: [
          { name: 'Greater London', latitude: 51.5074, longitude: -0.1278, popularAreas: ['Wembley (Ealing Road)', 'Harrow', 'Southall', 'Ilford', 'Croydon', 'Hounslow', 'Tooting (Shree Ganapathy Temple)', 'Neasden (BAPS Temple)', 'Kingston', 'Stratford', 'Barnet', 'Manor Park', 'East Ham (High Street North)'] },
          { name: 'South East & Home Counties', latitude: 51.4543, longitude: -0.9781, popularAreas: ['Reading', 'Slough', 'Milton Keynes', 'Southampton', 'Oxford', 'Brighton', 'Crawley', 'Watford', 'St Albans', 'Luton', 'Woking', 'Guildford'] }
        ]
      },
      {
        name: 'Midlands',
        cities: [
          { name: 'West Midlands', latitude: 52.4862, longitude: -1.8904, popularAreas: ['Birmingham (Tividale Balaji Temple)', 'Coventry', 'Wolverhampton', 'Walsall', 'Solihull', 'Sutton Coldfield', 'Dudley', 'West Bromwich'] },
          { name: 'East Midlands', latitude: 52.6369, longitude: -1.1398, popularAreas: ['Leicester (Belgrave Road / Golden Mile)', 'Nottingham', 'Derby', 'Northampton', 'Loughborough'] }
        ]
      },
      {
        name: 'North & Scotland & Wales',
        cities: [
          { name: 'North West & Yorkshire', latitude: 53.4808, longitude: -2.2426, popularAreas: ['Manchester', 'Bolton', 'Stockport', 'Preston', 'Liverpool', 'Leeds', 'Bradford', 'Sheffield', 'Huddersfield', 'Newcastle upon Tyne'] },
          { name: 'Scotland & Wales', latitude: 55.8642, longitude: -4.2518, popularAreas: ['Glasgow (Hindu Mandir)', 'Edinburgh', 'Aberdeen', 'Dundee', 'Cardiff', 'Swansea', 'Newport', 'Belfast'] }
        ]
      }
    ]
  },
  {
    code: 'AU',
    name: 'Australia',
    timezoneOffsetHours: 10.0,
    states: [
      {
        name: 'New South Wales (NSW)',
        cities: [
          { name: 'Sydney & Greater Western Sydney', latitude: -33.8688, longitude: 151.2093, popularAreas: ['Parramatta', 'Blacktown', 'Westmead', 'Wentworthville', 'Harris Park (Little India)', 'Strathfield', 'Liverpool', 'Helensburgh (Sri Venkateswara Temple)', 'Minto (Mukti-Gupteshwar)', 'Hornsby', 'Castle Hill', 'Ryde', 'Penrith', 'Chatswood', 'Marrickville'] },
          { name: 'Regional NSW', latitude: -32.9283, longitude: 151.7817, popularAreas: ['Newcastle', 'Wollongong', 'Central Coast (Gosford)', 'Wagga Wagga', 'Albury', 'Dubbo', 'Tamworth', 'Orange'] }
        ]
      },
      {
        name: 'Victoria (VIC)',
        cities: [
          { name: 'Melbourne Metro', latitude: -37.8136, longitude: 144.9631, popularAreas: ['Dandenong', 'Clayton', 'Glen Waverley', 'Point Cook', 'Tarneit', 'Truganina', 'Werribee', 'Carrum Downs (Shri Shiva Vishnu Temple)', 'Craigieburn', 'Epping', 'Reservoir', 'Box Hill', 'Springvale', 'Footscray', 'Richmond'] },
          { name: 'Regional Victoria', latitude: -38.1499, longitude: 144.3617, popularAreas: ['Geelong', 'Ballarat', 'Bendigo', 'Shepparton', 'Mildura', 'Warrnambool', 'Traralgon', 'Wodonga'] }
        ]
      },
      {
        name: 'Queensland, WA, SA, ACT, TAS, NT',
        cities: [
          { name: 'Brisbane & Gold Coast (QLD)', latitude: -27.4698, longitude: 153.0251, popularAreas: ['Brisbane (South Brisbane)', 'Sunnybank', 'Chermside', 'Upper Mount Gravatt', 'Ipswich (Springfield)', 'Gold Coast (Southport)', 'Sunshine Coast', 'Cairns', 'Townsville', 'Toowoomba'] },
          { name: 'Perth (WA)', latitude: -31.9505, longitude: 115.8605, popularAreas: ['Perth City', 'Canning Vale', 'Morley', 'Joondalup', 'Fremantle', 'Victoria Park', 'Armadale', 'Mandurah', 'Rockingham'] },
          { name: 'Adelaide (SA)', latitude: -34.9285, longitude: 138.6007, popularAreas: ['Adelaide City', 'Prospect', 'Mawson Lakes', 'Marion', 'Salisbury', 'Glenelg', 'Norwood', 'Port Adelaide'] },
          { name: 'Canberra, Hobart & Darwin', latitude: -35.2809, longitude: 149.1300, popularAreas: ['Canberra (Civic, Belconnen, Gungahlin, Tuggeranong)', 'Hobart (Sandy Bay, Glenorchy)', 'Launceston', 'Darwin (Casuarina, Palmerston)', 'Alice Springs'] }
        ]
      }
    ]
  },
  {
    code: 'CA',
    name: 'Canada',
    timezoneOffsetHours: -5.0,
    states: [
      {
        name: 'Ontario',
        cities: [
          { name: 'Greater Toronto Area (GTA)', latitude: 43.6532, longitude: -79.3832, popularAreas: ['Scarborough (Tamil Community Hub)', 'Brampton', 'Mississauga', 'Markham', 'Toronto Downtown', 'Richmond Hill', 'Vaughan', 'North York', 'Etobicoke', 'Oakville', 'Burlington', 'Milton', 'Ajax', 'Pickering', 'Whitby', 'Oshawa'] },
          { name: 'Ottawa, Hamilton, Kitchener & London', latitude: 45.4215, longitude: -75.6972, popularAreas: ['Ottawa (Kanata / Nepean)', 'Hamilton', 'Kitchener-Waterloo', 'London (Ontario)', 'Windsor', 'Guelph', 'Kingston', 'Barrie', 'Niagara Falls', 'St. Catharines', 'Cambridge', 'Sudbury'] }
        ]
      },
      {
        name: 'British Columbia (BC)',
        cities: [
          { name: 'Metro Vancouver', latitude: 49.2827, longitude: -123.1207, popularAreas: ['Surrey (Payal Business Centre)', 'Vancouver (Punjabi Market / Downtown)', 'Burnaby', 'Richmond', 'Coquitlam', 'Delta', 'Langley', 'New Westminster', 'North Vancouver', 'Abbotsford', 'Victoria (Vancouver Island)', 'Kelowna'] }
        ]
      },
      {
        name: 'Alberta, Quebec & Other Provinces',
        cities: [
          { name: 'Calgary & Edmonton (AB)', latitude: 51.0447, longitude: -114.0719, popularAreas: ['Calgary (NE Calgary / Saddletowne)', 'Edmonton (Mill Woods)', 'Red Deer', 'Lethbridge', 'Fort McMurray'] },
          { name: 'Montreal & Other Provinces', latitude: 45.5017, longitude: -73.5673, popularAreas: ['Montreal (Cote-des-Neiges / Parc Extension)', 'Laval', 'Quebec City', 'Winnipeg (MB)', 'Regina (SK)', 'Saskatoon (SK)', 'Halifax (NS)', 'St. John\'s (NL)'] }
        ]
      }
    ]
  },
  {
    code: 'AE',
    name: 'United Arab Emirates & Gulf GCC',
    timezoneOffsetHours: 4.0,
    states: [
      {
        name: 'United Arab Emirates',
        cities: [
          { name: 'Dubai', latitude: 25.2048, longitude: 55.2708, popularAreas: ['Bur Dubai (Shiva/Krishna Temple Area)', 'Karama', 'Deira', 'Al Nahda', 'Al Qusais', 'Jumeirah Lakes Towers (JLT)', 'Dubai Marina', 'Al Barsha', 'Business Bay', 'Downtown Dubai', 'International City', 'Silicon Oasis', 'Jebel Ali (Hindu Temple Complex)'] },
          { name: 'Abu Dhabi', latitude: 24.4539, longitude: 54.3773, popularAreas: ['Abu Dhabi City', 'Abu Mureikha (BAPS Hindu Mandir Area)', 'Hamdan Street', 'Electra Street', 'Mussafah', 'Khalidiya', 'Al Reem Island', 'Mohammed Bin Zayed City', 'Al Ain'] },
          { name: 'Sharjah & Northern Emirates', latitude: 25.3463, longitude: 55.4209, popularAreas: ['Al Majaz', 'Al Nahda Sharjah', 'Al Rolla', 'Muwaileh', 'Ajman Downtown', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'] }
        ]
      },
      {
        name: 'Saudi Arabia, Qatar, Oman, Kuwait, Bahrain',
        cities: [
          { name: 'Doha & Qatar', latitude: 25.2854, longitude: 51.5310, popularAreas: ['Doha (Old Airport / Mansoura / Matar Qadeem)', 'Al Sadd', 'Al Wakrah', 'Al Rayyan', 'Al Khor', 'West Bay', 'Lusail'] },
          { name: 'Riyadh & Saudi Arabia', latitude: 24.7136, longitude: 46.6753, popularAreas: ['Riyadh (Batha / Malaz / Olaya)', 'Jeddah', 'Dammam', 'Al Khobar', 'Jubail', 'Mecca', 'Medina', 'Yanbu', 'Abha'] },
          { name: 'Muscat & Oman', latitude: 23.5859, longitude: 58.4059, popularAreas: ['Ruwi (Darsait Shiva Temple / Motheshwar Mandir)', 'Mutrah', 'Al Khuwair', 'Bowsher', 'Seeb', 'Salalah', 'Sohar', 'Nizwa'] },
          { name: 'Kuwait & Bahrain', latitude: 29.3759, longitude: 47.9774, popularAreas: ['Kuwait City', 'Salmiya', 'Hawalli', 'Farwaniya', 'Fahaheel', 'Manama (Shri Krishna Temple Bahrain)', 'Riffa', 'Muharraq', 'Juffair', 'Seef'] }
        ]
      }
    ]
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    timezoneOffsetHours: 12.0,
    states: [
      {
        name: 'North Island',
        cities: [
          { name: 'Auckland', latitude: -36.8485, longitude: 174.7633, popularAreas: ['Auckland CBD', 'Sandringham', 'Mount Roskill', 'Mount Albert', 'Manukau', 'Papatoetoe', 'Flat Bush', 'Epsom', 'Henderson', 'Albany', 'Takapuna', 'New Lynn'] },
          { name: 'Wellington & Hamilton', latitude: -41.2865, longitude: 174.7762, popularAreas: ['Wellington CBD', 'Lower Hutt', 'Porirua', 'Upper Hutt', 'Hamilton (Chartwell, Rototuna)', 'Tauranga', 'Rotorua', 'Palmerston North', 'Napier', 'Hastings', 'New Plymouth', 'Whangarei'] }
        ]
      },
      {
        name: 'South Island',
        cities: [
          { name: 'Christchurch & Dunedin', latitude: -43.5321, longitude: 172.6362, popularAreas: ['Christchurch Central', 'Riccarton', 'Papanui', 'Hornby', 'Dunedin', 'Queenstown', 'Nelson', 'Invercargill'] }
        ]
      }
    ]
  },
  {
    code: 'GLOBAL',
    name: 'Other Global Countries & Regions',
    timezoneOffsetHours: 0.0,
    states: [
      {
        name: 'Europe',
        cities: [
          { name: 'France (Paris)', latitude: 48.8566, longitude: 2.3522, popularAreas: ['Paris 18e (Ganesh Temple / La Chapelle / Little Jaffna)', 'Paris 10e', 'Sarcelles', 'Bobigny', 'Lyon', 'Marseille', 'Toulouse', 'Nice'] },
          { name: 'Germany (Berlin, Frankfurt, Munich)', latitude: 50.1109, longitude: 8.6821, popularAreas: ['Frankfurt am Main', 'Hamm (Sri Kamadchi Ampal Temple)', 'Berlin', 'Munich', 'Hamburg', 'Cologne', 'Stuttgart', 'Dusseldorf', 'Nuremberg'] },
          { name: 'Switzerland & Netherlands & Others', latitude: 47.3769, longitude: 8.5417, popularAreas: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Brussels (Belgium)', 'Antwerp', 'Rome (Italy)', 'Milan', 'Madrid (Spain)', 'Barcelona', 'Dublin (Ireland)'] }
        ]
      },
      {
        name: 'Africa & Caribbean & Indian Ocean',
        cities: [
          { name: 'Mauritius', latitude: -20.3484, longitude: 57.5522, popularAreas: ['Port Louis', 'Grand Baie', 'Ganga Talao (Grand Bassin)', 'Rose Hill', 'Curepipe', 'Quatre Bornes', 'Vacoas', 'Triolet', 'Flacq', 'Mahebourg'] },
          { name: 'South Africa', latitude: -29.8587, longitude: 31.0218, popularAreas: ['Durban (Chatsworth / Phoenix)', 'Johannesburg (Lenasia)', 'Pretoria (Laudium)', 'Cape Town', 'Pietermaritzburg'] },
          { name: 'Trinidad & Guyana & Reunion', latitude: 10.6918, longitude: -61.2225, popularAreas: ['Port of Spain (Trinidad)', 'Chaguanas', 'San Fernando', 'Georgetown (Guyana)', 'Berbice', 'Saint-Denis (Reunion Island)', 'Saint-Paul'] }
        ]
      },
      {
        name: 'South-East Asia & East Asia',
        cities: [
          { name: 'Thailand, Indonesia & Philippines', latitude: 13.7563, longitude: 100.5018, popularAreas: ['Bangkok (Sri Maha Mariamman / Silom)', 'Phuket', 'Pattaya', 'Bali (Denpasar / Ubud)', 'Jakarta', 'Medan', 'Manila', 'Cebu'] },
          { name: 'Hong Kong, Japan & South Korea', latitude: 22.3193, longitude: 114.1694, popularAreas: ['Hong Kong (Kowloon / Tsim Sha Tsui)', 'Tokyo (Nishi-Kasai / Edogawa)', 'Yokohama', 'Osaka', 'Seoul', 'Taipei'] }
        ]
      }
    ]
  }
];

export function estimateTimezoneOffset(lat: number, lng: number, country: string = ''): number {
  // Coordinate lookup supplies the correct civil zone (including half/quarter-hour
  // offsets and DST in effect today). Country and longitude heuristics below are
  // retained only as a fallback if the point is outside the timezone database.
  const timezoneId = getTimeZoneIdForCoordinates(lat, lng);
  if (timezoneId) {
    const currentOffset = getCurrentTimezoneOffset(timezoneId);
    if (currentOffset !== null) return Math.round(currentOffset * 60) / 60;
  }

  const c = (country || '').toLowerCase();
  if (c.includes('india') || c.includes('sri lanka') || c.includes('bharat') || c.includes('ceylon')) return 5.5;
  if (c.includes('nepal')) return 5.75;
  if (c.includes('bangladesh')) return 6.0;
  if (c.includes('fiji')) return 12.0;
  if (c.includes('singapore') || c.includes('malaysia') || c.includes('hong kong') || c.includes('taiwan') || c.includes('philippines') || c.includes('bali')) return 8.0;
  if (c.includes('japan') || c.includes('korea')) return 9.0;
  if (c.includes('thailand') || c.includes('indonesia') || c.includes('vietnam')) return 7.0;
  if (c.includes('united arab emirates') || c.includes('uae') || c.includes('dubai') || c.includes('oman') || c.includes('mauritius') || c.includes('reunion')) return 4.0;
  if (c.includes('qatar') || c.includes('saudi') || c.includes('kuwait') || c.includes('bahrain')) return 3.0;
  if (c.includes('united kingdom') || c.includes('uk') || c.includes('england') || c.includes('scotland') || c.includes('wales') || c.includes('ireland')) return 0.0;
  if (c.includes('france') || c.includes('germany') || c.includes('italy') || c.includes('spain') || c.includes('netherlands') || c.includes('belgium') || c.includes('switzerland') || c.includes('sweden') || c.includes('norway') || c.includes('denmark') || c.includes('poland') || c.includes('austria')) return 1.0;
  if (c.includes('new zealand')) return 12.0;

  // Australia zones
  if (c.includes('australia')) {
    if (lng > 140) return 10.0; // NSW, VIC, QLD, TAS, ACT
    if (lng > 129) return 9.5;  // SA, NT
    return 8.0;                 // WA
  }

  // USA & Canada zones
  if (c.includes('united states') || c.includes('usa') || c.includes('america') || c.includes('canada')) {
    if (lng > -75) return -4.0; // Atlantic / Eastern summer
    if (lng > -86) return -5.0; // Eastern Time (NY, NJ, FL, Toronto)
    if (lng > -102) return -6.0; // Central Time (Texas, Chicago)
    if (lng > -114) return -7.0; // Mountain Time (Denver, Phoenix)
    return -8.0;                // Pacific Time (California, Seattle, Vancouver)
  }

  // Fallback math
  const rawOffset = lng / 15.0;
  return Math.round(rawOffset * 2) / 2;
}
