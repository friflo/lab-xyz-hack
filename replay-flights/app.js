

const tracesTimeSlot = {};
const traceMap= { }

// Unix time in sec (not ms)
function dateTimeTag2UnixTime (tag) {
	// Convert  '2018-08-20-00' -> new Date ('2018-08-20T00:00')
	let startISO = tag.substring (0, 10) + 'T' + tag.substring (11, 13) + ':00:00Z';
	let time = new Date (startISO).getTime() / 1000;
	return time;
}

let display;
let pointLayer;
let pointProvider;

async function main() {
	
	const metaDataUrl = 'https://xyz.api.here.com/hub/spaces/T264ZTZs/bbox?west=-17.433&north=14.648&east=-17.432&south=14.647&access_token=lUP5mgM_enTdQl4QiHI6Qg'
	const metaResp = await fetch(metaDataUrl);
	const metaFeatures = await metaResp.json();
	for (let i = 0; i < metaFeatures.features.length; i++) {
		let f = metaFeatures.features[i];
		let tag = f.properties.tag;
		if (f.geometry.type == 'Point' && tag) {
			let start = dateTimeTag2UnixTime (tag);
			console.log ("time slot: " + new Date(start * 1000).toISOString() + " -> " + start);
			// mark time slot as available
			tracesTimeSlot[start] = { icao: { } };
		}
	}


	//specify your credentials for image and link layers
	var YOUR_ACCESS_TOKEN = window.parent.YOUR_ACCESS_TOKEN;

	// configure layers
	var layers = [
		new here.xyz.maps.layers.TileLayer({
			name: 'Image Layer',
			min: 1,
			max: 20,
			provider: new here.xyz.maps.providers.ImageProvider({
				name: 'Live Map',
				url : 'https://{SUBDOMAIN_INT_1_4}.mapcreator.tilehub.api.here.com/tilehub/wv_livemap_bc/png/sat/256/{QUADKEY}?access_token='+YOUR_ACCESS_TOKEN
			})
		})
	]
	// setup the Map Display
	window.display = display = new  here.xyz.maps.Map( document.getElementById("map"), {
		zoomLevel : 7,
		minLevel: 7,
		center: {
			longitude: -117.15406, latitude: 32.72966
		},
		// add layers to display
		layers: layers
	});



	// Create data layer with Space provider
	var myLayer = new here.xyz.maps.layers.TileLayer({
		name: 'mySpaceLayer',
		min: 4,
		max: 20,

		// Define provider for this layer
		provider: new here.xyz.maps.providers.SpaceProvider ({
			name:  'SpaceProvider',
			level: 4,
			space: 'T264ZTZs',
			credentials: {
				access_token: "lUP5mgM_enTdQl4QiHI6Qg"
			}
		}, (tile) => {
			const features = tile.data;
			for (let i = 0; i < features.length; i++) {
				let f = features[i];
				if (f.geometry.type == 'LineString') {
					let icao24 = f.properties.icao24;
					let start =    dateTimeTag2UnixTime(f.properties.tag);
					let slot = tracesTimeSlot[start];
					if (slot) {
						let flight = slot.icao[icao24];
						if (flight) {
							// console.log ("found also in other tile " + icao24);
						} else {
							slot.icao[icao24] = f;
						}
					}
					trace = traceMap[icao24];
					if (!trace)
						traceMap[icao24] = { feature: null }
				}
			}
			// setTracePositions();
			return tile.data;
		}),

		style:{
			styleGroups: {
				linkStyle: [
					{zIndex:0, type:"Line", stroke:"#FF0000", strokeWidth:1 }
				]
			},

			assign: function(feature, zoomlevel){
				return "linkStyle";
			}
		}
	})
	// Add the layer to display
	display.addLayer(myLayer);

	pointLayer =  new here.xyz.maps.layers.TileLayer({
		name: 'my Point Layer',
		min: 4,
		max: 20,
		provider: pointProvider = new here.xyz.maps.providers.LocalProvider ({
			name:  'my Point Provider'
		}),
		style:{
			styleGroups: {
				style: [
					{zIndex:0, type:"Circle", "fill": "#FFFFFF", radius: 4}, // "stroke": "#FFFFFF", 
					// {zIndex:1, type:"Text", textRef:"properties.name", fill:"#111", offsetY: 12, font: "bold 13px ariel"}
				]
			},
			assign: function(feature){
				return "style";
			}
		}
	});

	display.addLayer(pointLayer);

	myLayer.addEventListener('viewportReady', () => {
		autoAnimation();
	})

	let autoAnimation = () => {
		if (!autoAnimate)
			return;
		let now = Date.now() / 1000;
		if (lastAnimation) {
			let dif = (now - lastAnimation) * 0.05;
			animTime += dif;
			if (animTime > 1)
				animTime = 0;
			replayPos.value = animTime;
		}
		lastAnimation = now;

		setTracePositions (1534723200 + animTime * 60 * 60);
		display.refresh(pointLayer);
		requestAnimationFrame(autoAnimation)
	};


	replayPos = document.getElementById("replayPos")
	replayPos.oninput = (v) => {
		autoAnimate = false;
		animTime = parseFloat(replayPos.value); // [0..1]
		setTracePositions (1534723200 + animTime * 60 * 60);
		display.refresh(pointLayer);
	}
	replayPos.onchange = () => {
		autoAnimate = true;
		requestAnimationFrame(autoAnimation);
	}
}

let lastAnimation = undefined;
let animTime = 0;  // in range [0..1]
let autoAnimate = true;
// setTracePositions (time);

let replayPos;

function setTracePositions (time) {
	// pointProvider.clear();
	let count = 0;
	
	Object.keys(traceMap).forEach(function(key,index) {
		count++;
		let slot = tracesTimeSlot[1534723200];
		let trace = slot.icao[key];
		let times = trace.properties.times;
		let i = 0
		for (; i < times.length - 1; i++) {
			if (time < times[i])
				break;
		}
		let c1 = trace.geometry.coordinates[i];
		let coordinate = [c1[0], c1[1]];
		

		let feature = traceMap[key].feature;
		if (!feature) {
			let tracePos = {
				id: key,
				geometry: {
					// coordinates: [13.404954, 52.520008, 0], // Berlin
					coordinates: coordinate,
					type: "Point"
				},
				properties: {
				}
			}
			traceMap[key].feature = pointProvider.addFeature(tracePos);
		} else {
			pointProvider.modifyFeatureCoordinates (feature, coordinate);
		}
	});
	// console.log ("count", count)
}




