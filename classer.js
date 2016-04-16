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

wavesurfer.load('audio/'+songURL);
wavesurfer.on('ready', function() {
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

	var oldTime = 0, oldSeconds = 0, seconds = 0;
	wavesurfer.on('audioprocess', function(time) {
		if (time <= oldTime) { return; } // bug in audioprocess that sets time to 0.xxx seconds
		oldTime = time;
		seconds = time.toFixed(1);
		if (seconds !== oldSeconds) {
			oldSeconds = seconds;
			d3.select('#current-time').text(seconds+'s');
		}
	});

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

			var second = Math.floor(seconds);
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
});