

const {chain}  = require('stream-chain');
const {parser} = require('stream-json');
const {streamArray} = require('stream-json/streamers/StreamArray');

const fs   = require('fs');
const zlib = require('zlib');

const optionDefinitions = [
	{ name: 'in',  		type: String },
	{ name: 'out',  	type: String },
	{ name: 'prefix',  	type: String,	defaultValue: ""},
	{ name: 'unzip', 	type: Boolean, 	defaultValue: false },
	{ name: 'max',   	type: Number, 	defaultValue: 0 },
	{ name: 'pretty',   type: Boolean, 	defaultValue: false }
]

const commandLineArgs = require('command-line-args')
const opt = commandLineArgs(optionDefinitions)
 
let count = 0;

const icao24Map = { }


const fileIn = 	opt.in;
const outFile = opt.out
const prefix =	opt.prefix;
const unzip = 	opt.unzip;
const pretty = 	opt.pretty;
const max = 	opt.max;

const decimals = 100000;


const pipeline = chain([
	...[fs.createReadStream(fileIn)],
	... unzip ? [zlib.createGunzip()] : [],
	...[parser(),
		streamArray(),
		data =>
			{
				const value = data.value;
				const icao24 = value.icao24;
				entry = icao24Map[icao24];
				if (entry) {
					entry.count ++;
				} else {
					entry = icao24Map[icao24] = {			
						"count": 1,
						"samples": []
					}		
				}
				if(value.lon && value.lat && value.geoaltitude) {
					let lat = Math.round(value.lat * decimals) / decimals;
					let lon = Math.round(value.lon * decimals) / decimals;
	
					entry.samples.push({
						time: value.time,
						coordinate: [lon, lat] // value.geoaltitude]
					});
				}
				if ((++count % 10000) == 0)
					console.log ("count: " + count, " keys: " + Object.keys(icao24Map).length);
			}
		]
	]);

function compare_time(a,b) {
	if (a.time < b.time)
	  return -1;
	if (a.time > b.time)
	  return 1;
	return 0;
}


pipeline.on('data', () => {
});
pipeline.on('end', () => {
	console.log ("processed records: " + count)

	// sort samples by time
	Object.keys(icao24Map).forEach(function(key,index) {
		icao24Map[key].samples.sort(compare_time);
	});

	if (false) {
		const icao24Map_json = pretty? JSON.stringify(icao24Map, null, 4) : JSON.stringify(icao24Map);
		fs.writeFile('out/temp-' + fileIn, icao24Map_json, 'utf8', () => { });
	}

	// convert to geojson
	let features = [];
	let metaFeature = {
		"type": "Feature",
		"id": prefix + "_meta",
		"geometry": {
			"type":			"Point",
			"coordinates": 	[ -17.433 + Math.random() * 0.0001, // random Point at Dakar/Africa
							   14.647 + Math.random() * 0.0001]
		},
		"properties" : {
			created: 	new Date().toISOString(),
			tag:		prefix
		}
	}
	features.push(metaFeature);

	Object.keys(icao24Map).forEach(function(key,index) {
		let flight = icao24Map[key];
		if (flight.samples.length > 1) {
			let coords= [];
			let times= [];
			for (i = 0; i < flight.samples.length; i++) {
				const sample = flight.samples[i];
				coords.push (sample.coordinate);
				times.push (sample.time);
			}
			let feature = {
				"type": "Feature",
				"id": prefix + "_" + key,
				"geometry": {
					"type": "LineString",
					"coordinates": coords
				},
				"properties" : {
					"icao24": 	key,
					"tag":		prefix,
					"times":  	times
				}
			}
			if (max == 0 || features.length < max)
				features.push(feature);				  
		}
	});

	let collection = {
		"type": "FeatureCollection",
		"features": features
	};

	const collection_json = pretty? JSON.stringify(collection, null, 4) : JSON.stringify(collection);
	fs.writeFile(outFile, collection_json, 'utf8', () => { });
});

