'use strict';

var defaultSongURL = 'Yoko Kanno & Origa - Inner Universe (jamiemori remix).mp3';
var brushEnabled = false;
var exportedData, blocksData, blocksPerSec = 10, startTime, exportTime;
var symbolToClass = {}, currentSymbol, keyActivated;
var keyToSymbol = {
	// 32:' ',
	48:'0',49:'1',50:'2',51:'3',52:'4',53:'5',54:'6',55:'7',56:'8',57:'9',
	65:'A',66:'B',67:'C',68:'D',69:'E',70:'F',71:'G',72:'H',73:'I',74:'J',75:'K',76:'L',77:'M',78:'N',79:'O',80:'P',81:'Q',82:'R',83:'S',84:'T',85:'U',86:'V',87:'W',88:'X',89:'Y',90:'Z',
	// 188:',',190:'.',
};
var letterArray = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
var numberArray = ['0','1','2','3','4','5','6','7','8','9'];
var wavesurferOpts = {
	height: 128,
	waveColor: "black",
	progressColor: "#999",
	cursorColor: "#333",
	cursorWidth: 1,
	skipLength: 2,
	minPxPerSec: 20,
	pixelRatio: window.devicePixelRatio,
	fillParent: !0,
	scrollParent: !1,
	hideScrollbar: !1,
	normalize: !1,
	audioContext: null,
	container: '#waveform',
	dragSelection: !0,
	loopSelection: !0,
	audioRate: 1,
	interact: !0,
	splitChannels: !1,
	mediaContainer: null,
	mediaControls: !1,
	renderer: "Canvas",
	backend: "WebAudio",
	mediaType: "audio",
	autoCenter: !0,
}
var wavesurfer = WaveSurfer.create(wavesurferOpts);
wavesurfer.on('loading', function(a) {
	// Fires continuously when loading via XHR or drag'n'drop. Callback will receive (integer) loading progress in percents [0..100] and (object) event target.
	d3.select('#initial-items').text('Loading at '+a+'%');
});
wavesurfer.on('error', function(xhrError) {
	// Occurs on error. Callback will receive (string) error message.
	d3.select('#initial-items').text('Error loading '+songURL);
});
wavesurfer.on('ready', function() {
	// When audio is loaded, decoded and the waveform drawn.
	d3.selectAll('.unloaded').classed('unloaded', false);
	d3.select('#initial-items').remove();
	d3.select('#song-title').text(songURL);
	Main();
});
var songURL;
if (sessionStorage.songURL === undefined) {
	songURL = defaultSongURL;
	sessionStorage.setItem('songURL', songURL);
} else {
	songURL = sessionStorage.songURL;
}
d3.select('#load-wavesurfer-button')
	.on('click', function() {
		songURL = d3.select('#song-url-form').node().value;
		sessionStorage.setItem('songURL', songURL);
		wavesurfer.load('../static/audio/'+songURL);
		d3.select('#initial-items').selectAll('*').remove();
		d3.select('#initial-items').text('Loading at 0%');
	});
d3.select('#song-url-form')
	.each(function() { this.value = songURL; })
	.on('change', function() {
		songURL = this.value;
		sessionStorage.setItem('songURL', songURL);
	});
d3.select('#defaults-button')
	.on('click', function() {
		songURL = defaultSongURL;
		sessionStorage.setItem('songURL', songURL);
		d3.select('#song-url-form').node().value = songURL;
	});

function Main() {
	var waveformHeight = wavesurferOpts.height+50;
	d3.select('wave').style('height', waveformHeight);

	startTime = new Date().getTime();
	var unitHeight = wavesurfer.params.height;
	var numSeconds = Math.ceil(wavesurfer.getDuration());
	var wsZoomScale = d3.scale.linear()
		.domain([1,2])
		.range([wavesurfer.drawer.params.minPxPerSec, 2*wavesurfer.drawer.params.minPxPerSec]);
	var zoomValue = 1.5;
	var minPxPerSec = wsZoomScale(zoomValue);
	wavesurfer.zoom(minPxPerSec); // this is not initialized by WaveSurfer for some reason
	d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+minPxPerSec+'\tpixels/s)');

	var waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	var waveContainer = d3.select('#waveform').select('wave');
	var svg = waveContainer.append('svg')
		.attr('width', waveformWidth)
		.attr('height', waveformHeight);
	var blocksRoot = svg.append('g').attr('class', 'blocks-root')
		.attr('transform', 'translate(0,0)');
	blocksData = d3.range(numSeconds*blocksPerSec)
		.map(function(d) { return {class:'0', time:(d/blocksPerSec)}; });
	var blocksGs = blocksRoot.selectAll('g').data(blocksData);
	blocksGs.enter().append('g').attr('class', 'block-g')
		.each(function(d) {
			d3.select(this).append('rect')
				.classed('block-rect', true)
				.classed('class'+d.class, true)
				.attr('x', 0)
				.attr('y', 0)
				.attr('width', minPxPerSec/blocksPerSec)
				.attr('height', unitHeight);
			// d3.select(this).append('text')
			// 	.classed('text-label', true)
			// 	.attr({
			// 		x: 0.5*minPxPerSec/blocksPerSec,
			// 		y: 0*unitHeight+1*15,
			// 	})
			// 	.text(d);
		});
	blocksGs
		.attr('transform', function(d,i) {
			var xT = i*minPxPerSec/blocksPerSec;
			var yT = 0;
			return 'translate('+xT+','+yT+')';
		});
	var secondsRoot = svg.append('g')
		.attr('transform', 'translate(0,'+(waveformHeight-40)+')');
	var secondsData = d3.range(numSeconds*blocksPerSec);
	var secondsLabels = secondsRoot.selectAll('text').data(secondsData);
	secondsLabels.enter()
		.append('text')
			.classed('label', true)
			.attr({
				x: function(d) { return d*minPxPerSec; },
				y: 0.5*20,
			})
			.text(function(d) {
				if (d === 0) { return ''; }
				return d;
			});

	var xScale = d3.scale.linear()
		.domain([0, blocksData.length-1])
		.range([0, waveformWidth]);

	var brush = d3.svg.brush()
		.x(xScale)
		.on('brushstart', function() {
			Update('brushstart');
		})
		// .on('brush', brushed)
		.on('brushend', function() {
			brushed();
			clearBrush();
		});
	blocksRoot.append('g')
		.attr('class', 'brush')
		.call(brush)
		.selectAll('rect')
			.attr('y', 2)
			.attr('height', wavesurferOpts.height-4);

	function brushed() {
		var minIndex = Math.floor(brush.extent()[0]);
		var maxIndex = Math.ceil(brush.extent()[1]);
		var newClassNumber = (symbolToClass[currentSymbol] !== undefined) ? symbolToClass[currentSymbol] : '0';
		for (var i=minIndex; i<=maxIndex; i++) {
			ChangeBlockAtIndex(i, newClassNumber);
		}
	};

	function updateBrushColor() {
		var newClassNumber = (symbolToClass[currentSymbol] !== undefined) ? symbolToClass[currentSymbol] : '0';
		blocksRoot.selectAll('.brush rect.extent')
			.attr('class', 'extent') // reset classes
			.classed('class'+newClassNumber, true);
	}

	function clearBrush() {
		blocksRoot.selectAll('g.brush').call(brush.clear());
	};

	var oldTime = 0, oldSecondsFloat = 0, secondsFloat = 0;
	wavesurfer.on('audioprocess', function(time) {
		// Fires continuously as the audio plays. Also fires on seeking.
		var backup_oldTime = oldTime;
		if (time <= oldTime) { return; } // bug in audioprocess that sets time to 0.xxx secondsFloat
		oldTime = time;
		secondsFloat = Math.floor(10*time)/10;
		if (secondsFloat !== oldSecondsFloat) {
			oldSecondsFloat = secondsFloat;
			Update('audioprocess');
		}
	});
	wavesurfer.on('seek', function(progress) {
		// On seeking. Callback will receive (float) progress [0..1].
		oldTime = progress*wavesurfer.getDuration();
		secondsFloat = Math.floor(10*oldTime)/10;
		// Update('seek');
	});
	wavesurfer.on('zoom', function(minPxPerSec) {
		// On zooming. Callback will receive (integer) minPxPerSec.
	});
	// wavesurfer.on('error', function(a, b, c, d, e, f) {
	// 	// Occurs on error. Callback will receive (string) error message.
	// 	console.log('error');
	// 	console.log(a, b, c, d, e, f);
	// });
	wavesurfer.on('finish', function() {
		// When it finishes playing.
	});
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
		.on('mousedown', function() {
			wavesurfer.playPause();
			if (wavesurfer.backend.isPaused() === true) {
				this.textContent = 'Play Track';
			} else {
				this.textContent = 'Pause Track';
			}
		});

	d3.select('#interaction-mode-text').text('Automatic classification as audio plays. Click waveform to change time.');

	d3.select('#interaction-mode-button')
		.on('mousedown', function() {
			if (brushEnabled === false) {
				brushEnabled = true;
				window._disable_wavesurfer_seek = true;
				d3.select('#waveform').classed('brush-enabled', true);
				d3.select('#interaction-mode-text').text('Manual classification. Click and drag waveform to add a class');
			} else {
				brushEnabled = false;
				window._disable_wavesurfer_seek = false;
				d3.select('#waveform').classed('brush-enabled', false);
				d3.select('#interaction-mode-text').text('Automatic classification as audio plays. Click waveform to change time.');
			}
			console.log('brushEnabled = '+brushEnabled);
		});

	d3.select('#export-data-button')
		.on('click', function() {
			ExportData();
		});

    var playbackSpeed = 1.0;
    d3.select('#speed-slider')
        .on('change', function() {
            playbackSpeed = this.value;
            d3.select('#speed-value').text(parseFloat(playbackSpeed).toFixed(1));
            wavesurfer.setPlaybackRate(playbackSpeed);
            Update('speed-slider');
        });

	d3.select('#zoom-slider')
		.on('change', function() {
            Update('zoom-sliderStart');
			zoomValue = Number(this.value);
			minPxPerSec = wsZoomScale(zoomValue);
			wavesurfer.zoom(minPxPerSec);
			d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+minPxPerSec+'\tpixels/s)');
			waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
			svg.attr('width', waveformWidth);
			blocksGs
				.attr('transform', function(d,i) {
					var xT = i*minPxPerSec/blocksPerSec;
					var yT = 0;
					return 'translate('+xT+','+yT+')';
				})
				.each(function(d) {
					d3.select(this).selectAll('rect')
						.attr('width', minPxPerSec/blocksPerSec);
					// d3.select(this).selectAll('text')
					// 	.attr({
					// 		x: 0.5*minPxPerSec/blocksPerSec,
					// 	});
				});
			secondsLabels
				.attr({
					x: function(d) { return d*minPxPerSec; },
				});
            Update('zoom-sliderEnd');
		});

	symbolToClass = {};
	d3.selectAll('#class1-label, #class1-submit').datum({class:'1'});
	d3.selectAll('#class2-label, #class2-submit').datum({class:'2'});
	d3.selectAll('#class1-label, #class2-label')
		.each(function(d) {
			symbolToClass[this.textContent] = d.class;
		});
	d3.selectAll('#class1-submit, #class2-submit')
		.on('click', function(d) {
			var oldValue = d3.select('#class'+d.class+'-label').text();
			var newValue = d3.select('#class'+d.class+'-form').node().value.toUpperCase();
			d3.select('#class'+d.class+'-form').node().value = '';
			if (letterArray.indexOf(newValue) !== -1 || numberArray.indexOf(newValue) !== -1) {
				delete(symbolToClass[oldValue]);
				symbolToClass[newValue] = d.class;
				d3.select('#class'+d.class+'-label').text(newValue);
			}
		});

	var classHistoryData = [], currentString = '';
	var classCounters = {'0':blocksData.length, '1':0, '2':0};
	d3.select('#class-counters')
		.text('0:'+classCounters['0']+' 1:'+classCounters['1']+' 2:'+classCounters['2'])
	keyActivated = false;
	//           shift multi
	// keypress  no    yes
	// keydown   yes   yes
	// keyup	 yes   no
	$(document)
		.on('keydown', function(event) {
			if (d3.select(document.activeElement.parentElement).classed('settings') === true) { return; }
			var newSymbol = keyToSymbol[event.which];
			if (newSymbol === currentSymbol && keyActivated === false) { return; }
			if (newSymbol !== currentSymbol) {
				currentSymbol = newSymbol;
				keyActivated = false;
			} else if (newSymbol === currentSymbol && keyActivated === true) {
				currentSymbol = undefined;
				keyActivated = false;
			} else if (newSymbol === currentSymbol && keyActivated === false) {
				currentSymbol = newSymbol;
			}
			Update('keydown');
		})
		.on('keyup', function(event) {
			keyActivated = true;
			Update('keyup');
		})
		// .on('keypress', function(event) {
		// 	if (event.shiftKey === true) { shiftKeyDown = false; } 
		// 	Update('keypress');
		// })
		;

	function Update(source) {
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		if (brushEnabled === true) {
			updateBrushColor();
		}
		if (currentSymbol === undefined) {
			d3.select('#key-pressed').text('');
		} else {
			d3.select('#key-pressed').text(currentSymbol);
		}
		if (brushEnabled === false) {
	        var blocksIndex = parseInt(secondsFloat*blocksPerSec);
	        var newClassNumber = (symbolToClass[currentSymbol] !== undefined) ? symbolToClass[currentSymbol] : '0';
	        ChangeBlockAtIndex(blocksIndex, newClassNumber);
	    }
	};

	function ChangeBlockAtIndex(blocksIndex, newClassNumber) {
		var block = d3.select(blocksGs[0][blocksIndex]);
        var oldClassNumber = block.selectAll('rect').datum()['class'];
        blocksData[blocksIndex].class = newClassNumber;
		block
			.datum(newClassNumber)
			.each(function(d) {
				d3.select(this).selectAll('rect')
					.attr('class', 'block-rect') // reset classes
					.classed('class'+d, true);
				// d3.select(this).selectAll('text').text(d);
			});
		// console.log(secondsFloat+'\t'+source);
        classCounters[oldClassNumber] -= 1;
        classCounters[newClassNumber] += 1;
        d3.select('#class-counters')
            .text('0:'+classCounters['0']+'\t1:'+classCounters['1']+'\t2:'+classCounters['2'])
	}

	function ExportData() {
		exportTime = new Date().getTime();
		exportedData = {};
		exportedData.metadata = {
			songURL:songURL,
			songDurationSec:wavesurfer.getDuration(),
			blocksPerSec:blocksPerSec,
			classCounters:classCounters,
			startTime:startTime,
			exportTime:exportTime,
			elapsedSec:(exportTime-startTime)/1000,
			class1Key:d3.select('#class1-label').text(),
			class2Key:d3.select('#class2-label').text(),
			zoomValue:zoomValue,
			playbackSpeed:playbackSpeed,

		};
		exportedData.blocksData = blocksData;
		console.log(exportedData);
		$.ajax({
			type: 'POST',
			url: 'exportedData',
			data: JSON.stringify(exportedData),
            async: false,
			success: function() {
                console.log('success');
            },
			dataType: 'json',
		});
	};
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

wavesurferOpts = {
    height: 128,
    waveColor: "#999",
    progressColor: "#555",
    cursorColor: "#333",
    cursorWidth: 1,
    skipLength: 2,
    minPxPerSec: 20,
    pixelRatio: window.devicePixelRatio,
    fillParent: !0,
    scrollParent: !1,
    hideScrollbar: !1,
    normalize: !1,
    audioContext: null ,
    container: null ,
    dragSelection: !0,
    loopSelection: !0,
    audioRate: 1,
    interact: !0,
    splitChannels: !1,
    mediaContainer: null ,
    mediaControls: !1,
    renderer: "Canvas",
    backend: "WebAudio",
    mediaType: "audio",
    autoCenter: !0
},
*/