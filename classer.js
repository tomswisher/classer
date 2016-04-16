'use strict';

var songURL = 'Yoko Kanno & Origa - Inner Universe (jamiemori remix).mp3';
var wavesurfer = WaveSurfer.create({
	container: '#waveform',
	wavecolor: 'green',
	progressColor: 'blue',
	// "height": 128,
	// "waveColor": "#999",
	// "progressColor": "blue",
	// "cursorColor": "#333",
	// "cursorWidth": 1,
	// "skipLength": 2,
	// "minPxPerSec": 20,
	// "pixelRatio": 1,
	// "fillParent": true,
	// "scrollParent": false,
	// "hideScrollbar": false,
	// "normalize": false,
	// "audioContext": null,
	// "container": "#waveform",
	// "dragSelection": true,
	// "loopSelection": true,
	// "audioRate": 1,
	// "interact": true,
	// "splitChannels": false,
	// "mediaContainer": null,
	// "mediaControls": false,
	// "renderer": "Canvas",
	// "backend": "WebAudio",
	// "mediaType": "audio",
	// "autoCenter": true,
	// "wavecolor": "green"
});
wavesurfer.on('loading', function() {
	// Fires continuously when loading via XHR or drag'n'drop. Callback will receive (integer) loading progress in percents [0..100] and (object) event target.
});
wavesurfer.on('ready', function() {
	// When audio is loaded, decoded and the waveform drawn.
	Main();
});
wavesurfer.load('audio/'+songURL);

function Main() {
	var unitHeight = wavesurfer.params.height;
	var minPxPerSec = wavesurfer.drawer.params.minPxPerSec;
	var ebPerSec = 1;
	wavesurfer.zoom(minPxPerSec); // this is not initialized by WaveSurfer for some reason
	var wsZoomScale = d3.scale.linear()
		.domain([1,2])
		.range([minPxPerSec, 2*minPxPerSec]);
	var numSecondBlocks = Math.ceil(wavesurfer.getDuration());

	var waveContainer = d3.select('#waveform').select('wave');
	var svg = waveContainer
		.append('svg')
			.attr({
				width: minPxPerSec*wavesurfer.getDuration(),
				height: unitHeight,
			});
	var echoblocksRoot = svg.append('g');
	var echoblocksData = d3.range(numSecondBlocks*ebPerSec).map(function() { return unitHeight*1; });
	var echoblocksGs = echoblocksRoot.selectAll('g').data(echoblocksData);
	echoblocksGs.enter()
		.append('g').each(function(d) {
			d3.select(this).append('rect')
				.attr('class', 'echoblock-rect unclassed')
				.attr({
					x: 0,
					y: 0,
					width: minPxPerSec/ebPerSec,
					height: function(d) { return d; },
				});
			d3.select(this).append('text')
				.classed('text-label', true)
				.attr({
					x: 0.5*minPxPerSec*ebPerSec,
					y: 0*unitHeight+1*15,
				})
				.text('');
		});
	echoblocksGs
		.attr('transform', function(d,i) {
			var xT = i*minPxPerSec*ebPerSec;
			var yT = 0;
			return 'translate('+xT+','+yT+')';
		});

	d3.selectAll('.unloaded').classed('unloaded', false);

	var oldTime = 0, oldSeconds = 0, secondsFloat = 0;
	wavesurfer.on('audioprocess', function(time) {
		// Fires continuously as the audio plays. Also fires on seeking.
		if (time <= oldTime) { return; } // bug in audioprocess that sets time to 0.xxx secondsFloat
		oldTime = time;
		secondsFloat = time.toFixed(1);
		if (secondsFloat !== oldSeconds) {
			oldSeconds = secondsFloat;
			d3.select('#current-time').text(secondsFloat+'s');
		}
	});
	wavesurfer.on('seek', function(progress) {
		// On seeking. Callback will receive (float) progress [0..1].
		console.log('seek');
		console.log(progress);
		secondsFloat = (progress*wavesurfer.getDuration()).toFixed(1);
	});
	wavesurfer.on('zoom', function(minPxPerSec) {
		// On zooming. Callback will receive (integer) minPxPerSec.
		console.log('zoom');
		console.log(minPxPerSec);
	});
	// wavesurfer.on('error', function(a, b, c, d, e, f) {
	// 	// Occurs on error. Callback will receive (string) error message.
	// 	console.log('error');
	// 	console.log(a, b, c, d, e, f);
	// });
	// wavesurfer.on('finish', function(a, b, c, d, e, f) {
	// 	// When it finishes playing.
	// 	console.log('finish');
	// 	console.log(a, b, c, d, e, f);
	// });
	// wavesurfer.on('pause', function() {
	// 	// When audio is paused.
	// 	console.log('pause');
	// });
	// wavesurfer.on('play', function() {
	// 	// When play starts.
	// 	console.log('play');
	// });
	// wavesurfer.on('scroll', function(scrollEvent) {
	// 	// When the scrollbar is moved. Callback will receive a ScrollEvent object.
	// 	console.log('scroll');
	// 	console.log(scrollEvent);
	// });


	d3.select('#play-pause-button')
		.on('click', function() {
			wavesurfer.playPause();
		});

	d3.select('#zoom-slider')
		.on('change', function() {
			var zoomValue = Number(this.value);
			minPxPerSec = wsZoomScale(zoomValue);
			requestAnimationFrame(function() {
				wavesurfer.zoom(minPxPerSec);
				d3.select('#zoom-level')
					.text(zoomValue);
				svg
					.attr({
						width: minPxPerSec*wavesurfer.getDuration(),
					});
				echoblocksGs
					.attr('transform', function(d,i) {
						var xT = i*minPxPerSec*ebPerSec;
						var yT = 0;
						return 'translate('+xT+','+yT+')';
					})
					.each(function(d) {
						d3.select(this).selectAll('text')
							.attr({
								x: 0.5*minPxPerSec*ebPerSec,
							});
						d3.select(this).selectAll('rect')
							.attr({
								width: minPxPerSec,
							});
					});
			});
		});

	var letterArray = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
	var numberArray = ['0','1','2','3','4','5','6','7','8','9'];
	var letterToClass = {}, oldFormValues = {};
	d3.selectAll('#class1-form').datum('class1');
	d3.selectAll('#class2-form').datum('class2');
	d3.selectAll('#class1-form, #class2-form')
		.each(function(d) {
			letterToClass[this.value.toUpperCase()] = d;
		})
		.on('keydown', function(d) {
			oldFormValues[d] = this.value.toUpperCase();
		})
		.on('keyup', function(d) {
			if (letterArray.indexOf(this.value.toUpperCase()) === -1 && numberArray.indexOf(this.value.toUpperCase()) === -1) {
				this.value = oldFormValues[d];
			}
			delete(letterToClass[oldFormValues[d]]);
			letterToClass[this.value.toUpperCase()] = d;
		});

	var keyPressedArray, keysPressedData = [], currentString = '';
	var keyToLetter = {
		// 32:' ',
		48:'0',49:'1',50:'2',51:'3',52:'4',53:'5',54:'6',55:'7',56:'8',57:'9',
		65:'A',66:'B',67:'C',68:'D',69:'E',70:'F',71:'G',72:'H',73:'I',74:'J',75:'K',76:'L',77:'M',78:'N',79:'O',80:'P',81:'Q',82:'R',83:'S',84:'T',85:'U',86:'V',87:'W',88:'X',89:'Y',90:'Z',
		// 188:',',190:'.',
	};
	$(document)
		.bind('keydown', function(e) {
			if (d3.select(document.activeElement.parentElement).classed('settings') === true) { return; }
			var letter = keyToLetter[e.which];
			if (letter === undefined) { return; }
			letter = letter.toUpperCase();

			var second = Math.floor(secondsFloat);
			d3.select(echoblocksGs[0][second*ebPerSec])
				.each(function(d) {
					var newClass = (letterToClass[letter] !== undefined) ? letterToClass[letter] : 'unclassed';
					var newClassLetter = (letterToClass[letter] !== undefined) ? letterToClass[letter][5] : '';
					d3.select(this).selectAll('text')
						.text(newClassLetter);
					d3.select(this).selectAll('rect')
						.attr('class', 'echoblock-rect') // reset classes
						.classed(newClass, true);
				});
			d3.select('#key-pressed')
				.text(letter);
		    currentString += letter;
		    d3.select('#current-string')
		    	.text(currentString);
		})
		.bind('keyup', function(e) {
			if (d3.select(document.activeElement.parentElement).classed('settings') === true) { return; }
			var letter = keyToLetter[e.which];
			if (letter === undefined) { return; }
			letter = letter.toUpperCase();

			d3.select('#key-pressed')
				.text('');
			keysPressedData.push(letter);
			d3.select('#key-history')
				.text('['+keysPressedData+']');
		});
}

/*
wavesurfer.destroy(); // – Removes events, elements and disconnects Web Audio nodes.
wavesurfer.empty(); // – Clears the waveform as if a zero-length audio is loaded.
wavesurfer.getCurrentTime(); // – Returns current progress in secondsFloat.
wavesurfer.getDuration(); // – Returns the duration of an audio clip in secondsFloat.
wavesurfer.isPlaying(); // – Returns true if currently playing, false otherwise.
wavesurfer.load(url); // – Loads audio from URL via XHR. Returns XHR object.
wavesurfer.loadBlob(url); // – Loads audio from a Blob or File object.
wavesurfer.on(eventName, callback); // – Subscribes to an event. See WaveSurfer Events for the list of all events.
wavesurfer.un(eventName, callback); // – Unsubscribes from an event.
wavesurfer.unAll(); // – Unsubscribes from all events.
wavesurfer.pause(); // – Stops playback.
wavesurfer.play([start[, end]]); // – Starts playback from the current position. Optional start and end measured in secondsFloat can be used to set the range of audio to play.
wavesurfer.playPause(); // – Plays if paused, pauses if playing.
wavesurfer.seekAndCenter(progress); // – Seeks to a progress and centers view [0..1] (0 = beginning, 1 = end).
wavesurfer.seekTo(progress); // – Seeks to a progress [0..1] (0 = beginning, 1 = end).
wavesurfer.setFilter(filters); // - For inserting your own WebAudio nodes into the graph. See Connecting Filters below.
wavesurfer.setPlaybackRate(rate); // – Sets the speed of playback (0.5 is half speed, 1 is normal speed, 2 is double speed and so on).
wavesurfer.setVolume(newVolume); // – Sets the playback volume to a new value [0..1] (0 = silent, 1 = maximum).
wavesurfer.skip(offset); // – Skip a number of secondsFloat from the current position (use a negative value to go backwards).
wavesurfer.skipBackward(); // - Rewind skipLength secondsFloat.
wavesurfer.skipForward(); // - Skip ahead skipLength secondsFloat.
wavesurfer.stop(); // – Stops and goes to the beginning.
wavesurfer.toggleMute(); // – Toggles the volume on and off.
wavesurfer.toggleInteraction(); // – Toggle mouse interaction.
wavesurfer.toggleScroll(); // – Toggles scrollParent.
wavesurfer.zoom(pxPerSec); // – Horiontally zooms the waveform in and out. The parameter is a number of horizontal pixels per second of audio. It also changes the parameter minPxPerSec and enables the scrollParent option.

wavesurfer.on('audioprocess', function() {
	// – Fires continuously as the audio plays. Also fires on seeking.
});
wavesurfer.on('error', function() {
	// – Occurs on error. Callback will receive (string) error message.
});
wavesurfer.on('finish', function() {
	// – When it finishes playing.
});
wavesurfer.on('loading', function() {
	// – Fires continuously when loading via XHR or drag'n'drop. Callback will receive (integer) loading progress in percents [0..100] and (object) event target.
});
wavesurfer.on('pause', function() {
	// – When audio is paused.
});
wavesurfer.on('play', function() {
	// – When play starts.
});
wavesurfer.on('ready', function() {
	// – When audio is loaded, decoded and the waveform drawn.
});
wavesurfer.on('scroll', function() {
	// - When the scrollbar is moved. Callback will receive a ScrollEvent object.
});
wavesurfer.on('seek', function() {
	// – On seeking. Callback will receive (float) progress [0..1].
});
wavesurfer.on('zoom', function() {
	// – On zooming. Callback will receive (integer) minPxPerSec.
});
*/