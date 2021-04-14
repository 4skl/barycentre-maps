let positions = [];
let barycenter;
let landbarycenter;
let travelbarycenter;

let map;
let geocoder;
let markers_positions = [];
let marker_barycenter;
let marker_landbarycenter;
let marker_travelbarycenter;
let lands;

function posToString(pos){
  return ""+pos.lat+", "+pos.lng; //todo : iso 6709 conversion
}

function genLandMarkers(){
  for(let lng = -180; lng<180;lng++){
    for(let lat = -90; lat<90;lat++){
      if(isInLand({lat: lat, lng: lng})) addMarker({lat: lat, lng: lng});
    }
  }
}

//*Barycenter calculations
function toRad(v){
  return v*(Math.PI/180);
}

//haversine function
function haversine(angle){
  return Math.pow(Math.sin(angle/2), 2);
}

//use haversine formula (great circle distance)
function greatCircleDistance(p1,p2){
  let r = 6371009; //earth radius in meters
  let lat1 = toRad(p1.lat);
  let lat2 = toRad(p2.lat);
  let lng1 = toRad(p1.lng);
  let lng2 = toRad(p2.lng);
  return 2*r*Math.asin(Math.sqrt(haversine(lat2-lat1)+Math.cos(lat1)*Math.cos(lat2)*haversine(lng2-lng1)));
}

function distance(p1, p2){
  return greatCircleDistance(p1,p2);//distance in km
}

//cost : lower sum of squared distance between coordinates is better (assumed barycenter) 
function cost(pos, coordinate_list){
  let total_cost = 0;
  for(let coordinate of coordinate_list){
    total_cost += Math.pow(distance(pos, coordinate),2);
  }
  return total_cost;
}

function generateNearPosition(parent, max_lat, max_lng){ //todo : generate near distances in circle ?
  let lat = parent.lat+max_lat*(Math.random()*2-1);
  while(lat > 90){
    lat -= 90;
  }
  while(lat < -90){
    lat += 90;
  }

  let lng = parent.lng+max_lng*(Math.random()*2-1);
  while(lng > 180){
    lng -= 180;
  }
  while(lng < -180){
    lng += 180;
  }
  return {lat: lat, lng: lng}
}

function generateNearPositionBounded(parent, max_lat, max_lng, bound_lat, bound_lng){ //todo : generate near distances in circle ?
  let lat = parent.lat+max_lat*(Math.random()*2-1);
  while(lat > bound_lat[1]){
    lat -= bound_lat[1];
  }
  while(lat < bound_lat[0]){
    lat -= bound_lat[0];
  }

  let lng = parent.lng+max_lng*(Math.random()*2-1);
  while(lng > bound_lng[1]){
    lng -= bound_lng[1];
  }
  while(lng < bound_lng[0]){
    lng -= bound_lng[0];
  }
  return {lat: lat, lng: lng}
}



//
function findBarycenter(coordinate_list){
  if(coordinate_list.length == 1){
    return coordinate_list[0];
  }
  
  let t1 = performance.now();
  //TODO : Three constant to fine tune
  let k = 50;
  let iterations = 50;
  let division = 1.2;

  let span_lat = 90;
  let span_lng = 180;

  let best_pos = {lat: 0, lng: 0};
  let best_cost = cost(best_pos, coordinate_list);
  for(let i = 0; i<iterations; i++){
    //generate n random positions near the best point
    let pop = [];
    for(let j = 0;j<k;j++){
      pop.push(generateNearPosition(best_pos, span_lat, span_lng));
    }
    for(let p of pop){
      let c = cost(p, coordinate_list);
      if(best_cost>c){ //lower is better
        best_cost = c;
        best_pos = p;
      }
    }

    //console.log('best_cost : ', best_cost, 'best_pos : ', best_pos);

    span_lat/=division;
    span_lng/=division;
    
  }

  let t2 = performance.now();
  console.log('best_cost_land : ', best_cost,'took : ', t2-t1, 'ms');

  return best_pos;
}

//test resolve in land
function isInLand(pos, span=1){
  let lat_index = parseInt((-pos.lat+90)/span);
  let lng_index = parseInt((pos.lng+180)/span);
  let i = parseInt(lng_index*(180/span) + lat_index);
  let index_in_bytes = parseInt(i/8); 
  //console.log(i)
  return (lands[index_in_bytes] & (128>>parseInt(i%8))) != 0;
 // if land is an array return lands[parseInt(pos.lng/span+180/span)][parseInt(180/span-(pos.lat/span+90/span))] == 1;
}

//todo : test use standard algorithm to find barycenter, but with first pos as barycenter instead of {lat: 0, lng: 0}
function findLandBarycenter(coordinate_list, barycenter){
  //todo : start barycenter search with a point in each land surface, then search "barycenter" in each land => add land condition in points took for search (? land size => bigger search area ?) and finally take the best
  
  if(isInLand(barycenter)){
    console.log("in land")
    return barycenter;
  }

  let t1 = performance.now();
  //TODO : Three constant to fine tune
  let k = 50;
  let iterations = 50;
  let multiplier = 1.2; // division findbary
  let retry_count = 5;//if randomly peaked position wasn't land

  let span_lat_max = 90;
  let span_lng_max = 180;
  let span_lat = span_lat_max/multiplier**k;
  let span_lng = span_lng_max/multiplier**k;

  let best_pos = barycenter;
  let best_cost = null;
  for(let i = 0; i<iterations; i++){
    //generate n random positions near the best point
    let pop = [];
    for(let j = 0;j<k;j++){
      let gn = () => generateNearPosition(best_pos, span_lat, span_lng);
      for(let r = 0; r<retry_count; r++){
        p=gn();
        if(isInLand(p)){
          pop.push(p);
          break;
        }
      }
    }

    if(pop != []){
      for(let p of pop){
        let c = cost(p, coordinate_list);
        if(best_cost == null || best_cost>c){ //lower is better
          best_cost = c;
          best_pos = p;
        }
      }
    }

    //console.log('best_cost : ', best_cost, 'best_pos : ', best_pos);

    span_lat*=multiplier;
    span_lng*=multiplier;
    
  }

  let t2 = performance.now();
  console.log('best_cost : ', best_cost,'took : ', t2-t1, 'ms');

  return best_pos;
}


//! experimental

//todo : invert locations and destinations if locations.length < destinations.length ?
async function matrixDistance(locations, destinations){
  locations_f = locations.map((e) => [e.lng, e.lat]);
  locations_f = locations_f.concat(destinations.map((e) => [e.lng, e.lat]));
  let res_json = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
    method: 'POST',
    mode: 'cors',
    headers: new Headers({
      'Authorization': 'Add Open route service api keys',
      'Content-Type': 'application/json'
      }), 
    body: JSON.stringify({
      "locations": locations_f,
      "destinations": (new Array(destinations.length)).fill(locations.length).map((e,i) => e+i)
      })
    }).then(r => r.json());

  console.log(res_json)
  
  let destinations_cost = [];
  for(let i = 0;i<destinations.length;i++){
    let loc_cost = 0;
    for(let j = 0;j<locations.length;j++){
      loc_cost += res_json.durations[j][i];
    }
    if(loc_cost != 0){
      destinations_cost.push({destination: destinations[i], duration: loc_cost});
    }else{
      console.log("cost 0")
    }
  }
  /*
  res_json.durations.reduce((acc, el, i, a) => {
    if(i<locations.length){
      let loc_cost = 0;
      for(let j in el){ //destinations_index
        loc_cost += a[i][j]; // todo square ?
      }
      if(loc_cost != 0 && loc_cost != null){
        acc.push({location: locations[i-destinations.length], duration: loc_cost});
      }
    }
    return acc;
  }, []);*/

  return destinations_cost;
}

function generateNearPositionTravel(parent, span_lat, span_lng, stop=5){ //todo : generate near distances in circle ?
  if(stop == 0){
    return;
  }

  let lat = parent.lat+span_lat*(Math.random()*2-1);
  while(lat > 90){
    lat -= 90;
  }
  while(lat < -90){
    lat += 90;
  }

  let lng = parent.lng+span_lng*(Math.random()*2-1);
  while(lng > 180){
    lng -= 180;
  }
  while(lng < -180){
    lng += 180;
  }
  let pos = {lat: lat, lng: lng};
  if(!isInLand(pos)){
    pos = generateNearPositionTravel(pos, span_lat, span_lng, stop-1); // to improve
  }
  return pos;
}

async function findTravelBarycenter(coordinate_list, center={lat: 0, lng: 0}){
  let api_routes_max = 1000; //api max (k+coordinate_list.length)*k < api_routes_max
  //k+coordinate_list.length < api_routes_max/k
  let k_max = 0.5*(Math.sqrt(coordinate_list.length*coordinate_list.length+4*api_routes_max)-coordinate_list.length); //(api_routes_max-coordinate_list.length*coordinate_list.length)/coordinate_list.length;
  if(coordinate_list.length == 1 || coordinate_list.length > Math.sqrt(api_routes_max)){
    return coordinate_list[0];
  }
  
  let t1 = performance.now();
  //TODO : Three constant to fine tune
  let k = k_max < 55 ? k_max : 55;
  let iterations = 10;
  let division = 1.5; //2?

  let span_lat = 90;
  let span_lng = 180;

  let best_pos = center;
  let best_cost = null;
  for(let i = 0; i<iterations; i++){
    //generate n random positions near the best point
    let pop = [];
    for(let j = 0;j<k;j++){
      let npos = generateNearPositionTravel(best_pos, span_lat, span_lng);
      if(npos != null){
        pop.push(npos);
      }
    }

    console.log('pop', pop);
    if(pop.length > 0){

      let pop_cost = await matrixDistance(coordinate_list, pop);
      console.log('pop_cost', pop_cost)
      for(let p of pop_cost){
        if(best_cost == null || best_cost>p.duration){ //lower is better
          best_cost = p.duration;
          best_pos = p.destination;
        }
      }

    }

    console.log('travel_best_cost : ', best_cost, 'best_pos : ', best_pos);

    span_lat/=division;
    span_lng/=division;
    
  }

  await new Promise(r => setTimeout(r, 10)); //10 ms wait to not stress the api

  let t2 = performance.now();
  console.log('best_cost_travel : ', best_pos, best_cost,'took : ', t2-t1, 'ms');

  return best_pos;
}

//* Markers

function markerIndexPos(pos){
  for(let i in markers_positions){
    let marker = markers_positions[i];
    if(marker.position.lat() == pos.lat && marker.position.lng() == pos.lng){
      return i;
    }
  }
  return -1;
}

function sameMarkerPos(marker1, marker2){
  return (marker1.position.lat() == marker2.position.lat()) && (marker1.position.lng() == marker2.position.lng());
}

function addMarker(pos, title){
  return new google.maps.Marker({
    position: pos,
    map: map,
    title: title
  });
}

function removeMarker(marker){
  marker.setMap(null);
  marker = null;
}

function removeMarkerAt(index){
  if(index >= 0){
    removeMarker(markers_positions.splice(index,1)[0]);
    removeLocCard(index);
    positions.splice(index, 1);
    if(positions.length > 0){
      actualizeBarycenters();
    }else{
      removeMarker(marker_barycenter);
      removeMarker(marker_landbarycenter);
    }
  }
}

function removeMarkerByPos(pos){
  removeMarkerAt(markerIndexPos(pos));
}
//


function setBarycenter(pos){
  barycenter = pos;
  if(marker_barycenter){
    removeMarker(marker_barycenter);
  }
  marker_barycenter = addMarker(pos);
  marker_barycenter.setTitle("Barycenter");
  marker_barycenter.setIcon('/static/media/barycenter.svg');
}

function setLandBarycenter(pos){
  landbarycenter = pos;
  if(marker_landbarycenter){
    removeMarker(marker_landbarycenter);
  }
  marker_landbarycenter = addMarker(pos);
  marker_landbarycenter.setTitle("Land Barycenter");
  marker_landbarycenter.setIcon('/static/media/landbarycenter.svg');
}


function setTravelBarycenter(pos){
  travelbarycenter = pos;
  if(marker_travelbarycenter){
    removeMarker(marker_travelbarycenter);
  }
  marker_travelbarycenter = addMarker(pos);
  marker_travelbarycenter.setTitle("Travel Barycenter");
  marker_travelbarycenter.setIcon('/static/media/travelbarycenter.svg');
}

function setBarycentersInfo(){
  let bary_info = document.querySelector('#bary-info');
  bary_info.innerText = "";
  let title_bary = "Barycenter : " + posToString(barycenter);//tr
  let addBaryAddress = (addr) => {bary_info.innerText += title_bary + "\nAddress : " + addr};
  reverseGeocode(barycenter, addBaryAddress);

  let title_landbary = "\nLand Barycenter : " + posToString(landbarycenter);//tr
  let addLandBaryAddress = (addr) => {bary_info.innerText += title_landbary + "\nAddress : " + addr};
  setTimeout(() => reverseGeocode(landbarycenter, addLandBaryAddress), 100); //! Bad patch to avoid OVER_QUERY_LIMIT
}

async function actualizeBarycenters(){
  let bary = findBarycenter(positions);
  setBarycenter(bary);
  setLandBarycenter(findLandBarycenter(positions, bary, lands));
  setBarycentersInfo();
  tbary = await findTravelBarycenter(positions); //? center=landbarycenter
  console.log('tbary', tbary)
  setTravelBarycenter(tbary);
}

function removeLocCard(index){
  document.querySelector('#pos-list').children[index].remove();
}

function addLocCard(pos, address){
  let container = document.querySelector('#pos-list');
  let loc_card = document.createElement('div');
  loc_card.classList.add('loc-card');

  let address_field = document.createElement('p');
  address_field.innerText = address;
  loc_card.appendChild(address_field);

  let pos_field = document.createElement('p');
  pos_field.innerText = posToString(pos);
  loc_card.appendChild(pos_field);

  let remove_button = document.createElement('input');
  remove_button.type = 'image';
  remove_button.src = '/static/media/close.svg';
  remove_button.addEventListener('click', () => {
    removeMarkerByPos(pos);
  });
  loc_card.appendChild(remove_button)

  container.appendChild(loc_card);
}

function addPos(pos, address){
  if(address === undefined){
    reverseGeocode(pos, (addr) => addPos(pos, addr));
    return;
  }
  positions.push(pos);
  let marker = addMarker(pos);
  addLocCard(pos, address);
  marker.addListener("click", () => {
    removeMarkerByPos(pos);
  });
  markers_positions.push(marker);

  actualizeBarycenters();
}


//* search

function searchBar(query){
  searchPlace(query, searchBarShow)
}

function createSearchResultCard(result){
  let card = document.createElement('div');
  card.classList.add('search-result-card');

  let name = document.createElement('p');
  name.innerText = result.formatted_address;
  card.appendChild(name);
  
  card.addEventListener("click", () => {addPos({lat: result.geometry.location.lat(), lng: result.geometry.location.lng()}, result.formatted_address)});

  return card;
}

function searchBarShow(results){
  let results_container = document.querySelector('#results');
  results_container.innerHTML = "";
  results_container.classList.add('visible');
  if (results.length != 0){
    for(let result of results){
      results_container.appendChild(createSearchResultCard(result));
    }
  }else{
    let no_result_text = document.createElement('p');
    no_result_text.innerText = "No results";
    results_container.appendChild(no_result_text);
  }

}

//geocoding
function searchPlace(address, then){
  geocoder.geocode( { 'address': address}, function(results, status) {
    if (status == 'OK') {
      then(results);
    } else {
      console.error('Geocode was not successful for the following reason: ' + status);
    }
  });
}

//reverse geocoding
function reverseGeocode(latlng, then){
  geocoder.geocode({ location: latlng }, (results, status) => {
    if (status === "OK") {
      if (results[0]) {
        then(results[0].formatted_address); //return all result ?
      } else {
        console.error("No results found");
      }
    } else {
      console.error("Geocoder failed due to: " + status);
      then("Unknown"); //tr
    }
  });
}

//


//* initialization
function initGeocoder(){
  geocoder = new google.maps.Geocoder();
}

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 0, lng: 0 }, //make 0,0 instead
    zoom: 4,
  });
}

function getLands(){
  //fetch('/static/raw/map_8640x4320.bin').then(r => r.arrayBuffer()).then(a => lands = new Uint8Array(a));
  fetch('/static/raw/land_1_dec.bin').then(r => r.arrayBuffer()).then(a => lands = new Uint8Array(a));
  console.log('small land map precision')
  //fetch('/static/raw/land_array_2pt5.json').then(r => r.json()).then(json => lands = json['land_array']);
}

function initMapService(){
  initGeocoder();
  initMap();
  getLands();
  map.addListener('click', (r) => {addPos({lat: r.latLng.lat(), lng: r.latLng.lng()})});
}