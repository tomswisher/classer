'use strict';

var wavesurfer;
var logs = 0;
var debug = 0;
if (debug) { d3.selectAll('.debug').classed('debug', false); }
var trackPromptText = 'Click to choose a track';
var defaultSongURL = 'Yoko Kanno & Origa - Inner Universe (jamiemori remix).mp3';
var brushEnabled = false;
var exportedData, blocksData, blocksPerSec = 10, startTime, exportTime;
var oldTime = 0, oldSecondsFloat = 0, secondsFloat = 0;
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
	height: 200,
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
	container: '#wavesurfer-container',
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
var trackURL;
if (sessionStorage.trackURL === undefined) {
	trackURL = defaultSongURL;
	sessionStorage.setItem('trackURL', trackURL);
} else {
	trackURL = sessionStorage.trackURL;
}
InitWaveSurfer();

function InitWaveSurfer() {
	wavesurfer = WaveSurfer.create(wavesurferOpts);
	wavesurfer.on('loading', function(a) {
		// Fires continuously when loading via XHR or drag'n'drop. Callback will receive (integer) loading progress in percents [0..100] and (object) event target.
		// d3.select('#loading-value').text('Loading at '+a+'%');
		d3.select('#loading-value').text('Loading Track...');
	});
	wavesurfer.on('error', function(xhrError) {
		// Occurs on error. Callback will receive (string) error message.
		d3.select('#loading-value').text('Error loading '+trackURL);
	});
	wavesurfer.on('ready', function() {
		// When audio is loaded, decoded and the waveform drawn.
		setLoadedClass('loaded');
		d3.select('#loading-value').text('');
		Main();
	});

	d3.select('#loading-value').text('');
	d3.select('#track-url-value')
		.text((trackURL !== defaultSongURL) ? trackURL : trackPromptText)
		.on('click', function() {
			d3.select('#track-input').node().click();
		});
	d3.select('#track-input')
	    .on('change', function() {
	    	trackURL = this.files[0].name;
	    	sessionStorage.setItem('trackURL', trackURL);
	    	d3.select('#track-url-value').text(trackURL);
	    });
	d3.select('#track-load-button')
		.on('click', function() {
			setLoadedClass('unloaded');
			$(document).off();
			wavesurfer.destroy();
			requestAnimationFrame(function() {
				InitWaveSurfer();
				d3.select('#track-url-value').text(trackURL);
				// assumes you put audio in folder /static/audio
				wavesurfer.load('../static/audio/'+trackURL);
			});
		});
	d3.select('#track-clear-button')
		.on('click', function() {
			trackURL = defaultSongURL;
			sessionStorage.setItem('trackURL', defaultSongURL);
			d3.select('#track-url-value').text(trackPromptText);
			setLoadedClass('unloaded');
			$(document).off();
			wavesurfer.destroy();
			requestAnimationFrame(function() {
				InitWaveSurfer();
			});
		});
};

function Main() {
	var waveformHeight = wavesurferOpts.height+50;
	d3.select('wave').style('height', waveformHeight);

	startTime = new Date().getTime();
	var unitHeight = wavesurfer.params.height;
	var numSeconds = Math.ceil(wavesurfer.getDuration());
	var wsZoomScale = d3.scale.linear()
		.domain([1,2])
		.range([wavesurfer.drawer.params.minPxPerSec, 2*wavesurfer.drawer.params.minPxPerSec]);
	var zoomValue = Number(d3.select('#zoom-slider').node().value);
	var minPxPerSec = wsZoomScale(zoomValue);
	var waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	wavesurfer.zoom(minPxPerSec); // this is not initialized by WaveSurfer for some reason
	d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');

	var waveNode = d3.select('#wavesurfer-container').select('wave');
	waveNode.selectAll('svg').remove();
	var svg = waveNode.append('svg')
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

	var oldExtent = [0,0], isBrushing = false;
	var brush = d3.svg.brush()
		.x(xScale)
		.on('brushstart', function() {
			oldExtent = [brush.extent()[0], brush.extent()[1]];
			// console.log('brushstart', oldExtent, brush.extent());
		})
		.on('brush', function() {
			snapBrush();
			// console.log('brush     ', oldExtent, brush.extent());
			if (isBrushing === false) {
				var ext = [brush.extent()[0], brush.extent()[1]];
				if (ext[0] !== oldExtent[0] && ext[1] !== oldExtent[1] && ext[1]-ext[0] !== oldExtent[1]-oldExtent[0]) {
					// console.log('applyBrush');
					applyBrush(oldExtent[0], oldExtent[1]);
				}
				isBrushing = true;
			}
			oldExtent = [brush.extent()[0], brush.extent()[1]];
		})
		.on('brushend', function() {
			// console.log('brushend  ', oldExtent, brush.extent());
			isBrushing = false;
			// oldExtent = [brush.extent()[0], brush.extent()[1]];
			// if (brush.extent()[0] !== oldExtent[0] && brush.extent()[1] !== oldExtent[1]) {
			// 	willApplyBrush = true;
			// }
			// var brushExtentDiff = brush.extent()[1]-brush.extent()[0];
			// if (brushExtentDiff > 1) {
			// 	oldExtent = [brush.extent()[0], brush.extent()[1]];	
			// }
			// console.log('brushend', brush.extent(), oldExtent, brushExtentDiff);
		});
	blocksRoot.append('g')
		.attr('class', 'brush')
		.call(brush)
		.selectAll('rect')
			// .attr('y', 2)
			// .attr('height', wavesurferOpts.height-4);
			.attr('y', 0)
			.attr('height', wavesurferOpts.height-1);

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
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		// Update('seek');
	});
	wavesurfer.on('finish', function() {
		// – When it finishes playing.
		d3.select('#reset-ws-button').on('mousedown')();
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

	d3.select('#play-pause-ws-button')
		.on('mousedown', function() {
			wavesurfer.playPause();
			d3.select('#play-pause-ws-button')
				.text((wavesurfer.backend.isPaused() === true) ? 'Play' : 'Pause');
		});

	d3.select('#reset-ws-button')
		.on('mousedown', function() {
			if (wavesurfer.backend.isPaused() === false) {
				d3.select('#play-pause-ws-button').on('mousedown')();
			}
			oldTime = 0;
			secondsFloat = 0;
			wavesurfer.seekTo(secondsFloat);
			d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
			d3.select('wave').node().scrollLeft = 0;
		})

	var manualModeText    = 'Manual (click + drag to add a class)';
	var automaticModeText = 'Automatic (click to jump in time)';
	d3.select('#interaction-mode-text').text(automaticModeText);
	d3.select('#interaction-mode-button')
		.on('mousedown', function() {
			clearBrush();
			if (brushEnabled === false) {
				brushEnabled = true;
				window._disable_wavesurfer_seek = true;
				d3.select('#wavesurfer-container').classed('brush-enabled', true);
				d3.select('.brush').classed('brush-disabled', false);
				d3.select('#interaction-mode-text').text(manualModeText);
			} else {
				brushEnabled = false;
				window._disable_wavesurfer_seek = false;
				d3.select('#wavesurfer-container').classed('brush-enabled', false);
				d3.select('.brush').classed('brush-disabled', true);
				d3.select('#interaction-mode-text').text(automaticModeText);
			}
			// console.log('brushEnabled = '+brushEnabled);
		});

	d3.select('#export-data-button')
		.on('mousedown', function() {
			ExportData();
		});

    var playbackSpeed = 1.0;
    d3.select('#speed-slider')
        .on('change', function() {
        	clearBrush();
            playbackSpeed = this.value;
            d3.select('#speed-value').text(parseFloat(playbackSpeed).toFixed(1));
            wavesurfer.setPlaybackRate(playbackSpeed);
            Update('speed-slider');
        });

	d3.select('#zoom-slider')
		.on('change', function() {
			clearBrush();
            Update('zoom-sliderStart');
			zoomValue = Number(this.value);
			minPxPerSec = wsZoomScale(zoomValue);
			wavesurfer.zoom(minPxPerSec);
			d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
			waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
			xScale.range([0, waveformWidth]);
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
		.on('mousedown', function(d) {
			var classOther = (d.class === '1') ? '2' : '1';
			var oldValueOther = d3.select('#class'+classOther+'-label').text();
			var oldValue = d3.select('#class'+d.class+'-label').text();
			var newValue = d3.select('#class'+d.class+'-form').node().value.toUpperCase();
			d3.select('#class'+d.class+'-form').node().value = '';
			if (newValue === oldValueOther) { return; }
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
	currentSymbol = undefined;

	function onKeydown(event) {
		if (d3.select(document.activeElement.parentElement).classed('settings') === true) { return; }
		if (event.shiftKey === true) {
			d3.select('#interaction-mode-button').on('mousedown')();
			return;
		}
		if (event.which === 32) { // space
			d3.select('#play-pause-ws-button').on('mousedown')();
			return;
		}
		var newSymbol = keyToSymbol[event.which];
		// console.log(keyActivated, currentSymbol, newSymbol);
		if (newSymbol === currentSymbol && keyActivated === false) { return; }
		if (newSymbol !== currentSymbol) {
			currentSymbol = newSymbol;
			keyActivated = false;
		} else if (newSymbol === currentSymbol && keyActivated === true) {
			currentSymbol = undefined;
			keyActivated = false;
			return;
		} else if (newSymbol === currentSymbol && keyActivated === false) {
			currentSymbol = newSymbol;
		}
		Update('keydown');
	};

	function onKeyup(event) {
		keyActivated = true;
		if (event.which !== 16) { // not shift
			Update('keyup');
		}
	};

	$(document)
		.on('keydown', onKeydown)
		.on('keyup', onKeyup);

	requestAnimationFrame(function() {
		Update('Main');
	});

	function Update(source) {
		if (d3.select('body').classed('loaded') === false) { return; }
		// console.log('Update '+source);
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		if (brushEnabled === true) {
			updateBrushColor();
		}
		if (currentSymbol === undefined) {
			d3.select('#key-pressed').text('\u00A0');
			d3.selectAll('.class-outlined').call(classify, 0);
		} else {
			d3.select('#key-pressed').text(currentSymbol);
			d3.selectAll('.class-outlined').call(classify, symbolToClass[currentSymbol]);
		}
		if (brushEnabled === false) {
	        var blocksIndex = parseInt(secondsFloat*blocksPerSec);
	        var newClassNumber = (symbolToClass[currentSymbol] !== undefined) ? symbolToClass[currentSymbol] : '0';
	        ChangeBlockAtIndex(blocksIndex, newClassNumber);
	    }
	    if (debug) {
	    	var keyValueArray = [];
	    	var usedKeyHash = {};
	    	var valueString;
	    	var testRegExp = new RegExp('^get');
	    	var skippedKeysHash = {
	    		'wavesurfer.backend': ['gainNode', 'getAudioContext', 'getOfflineAudioContext', 'handlers'],
	    		'wavesurfer': ['backend', 'defaultParams', 'drawer', 'Drawer', 'getArrayBuffer', 'handlers', 'WebAudio']
	    	};
	    	var indentString;
	    	function addKeyValuePairs(myObject, keyText, indent) {
	    		var indentString = Array(indent).join('    ');
	    		var skippedKeys = (skippedKeysHash[keyText] !== undefined) ? skippedKeysHash[keyText] : [];
	    		// if (logs) console.log('Looping over key '+keyText+'" skipping:', skippedKeys);
	    		$.each(myObject, function(key, value) {
	    			// if (logs) console.log(indentString+'"'+key+'", '+typeof(value));
	    			if (skippedKeys.indexOf(key) !== -1) { return; }
	    			if (usedKeyHash[key] !== undefined) { return; }
	    			if (typeof(value) === 'function' && testRegExp.test(key) === true) {
	    				// if (logs) console.log(indentString, value, myObject);
	    				valueString = JSON.stringify(value.apply(myObject));
	    			} else {
	    				valueString = JSON.stringify(value);
	    			}
	    			if ([undefined, '{}'].indexOf(valueString) !== -1) { return; }
	    			if (typeof(value) === 'object' && value !== null) {
	    				// if (logs) console.log(indentString+'Stepping in to  "'+key+'" from "'+keyText+'" skipping:', skippedKeys);
	    				addKeyValuePairs(value, key, indent+1);
	    			} else {
	    				usedKeyHash[key] = valueString;
	    			}
	    		});
	    		// if (logs) console.log(indentString+'Done looping for "'+keyText+'"\n\n');
	    	};
	    	addKeyValuePairs(wavesurfer.backend, 'wavesurfer.backend', 0);
	    	addKeyValuePairs(wavesurfer, 'wavesurfer', 0);
	    	var metadata = {
	    		trackURL:trackURL,
	    		trackDurationSec:wavesurfer.getDuration(),
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
	    	addKeyValuePairs(metadata, 'metadata', 0);

	    	$.each(usedKeyHash, function(key, value) {
	    		keyValueArray.push({ 'key':key, 'value':value });
	    	});

	    	var rows = d3.select('#wavesurfer-debug').selectAll('div.plain-text').data(keyValueArray);
	    	rows.exit().remove();
	    	rows.enter().append('div').attr('class', 'plain-text').each(function(d) {
    			d3.select(this).append('span').attr('class', 'key-text');
    			d3.select(this).append('span').attr('class', 'value-text');
    		});
	    	rows.each(function(d) {
	    		var oldValue = d3.select(this).selectAll('span.value-text').attr('old-value');
	    		if (String(d.value) !== String(oldValue)) {
	    			d3.select(this).selectAll('span').interrupt()
	    				.style('color', 'red').transition().duration(1000).style('color', 'black');
	    		}
    			d3.select(this).selectAll('span.key-text').text(d.key);
    			d3.select(this).selectAll('span.value-text').text(d.value);
    			d3.select(this).selectAll('span.value-text').attr('old-value', d.value);
    		});
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
	};

	function applyBrush(minIndex, maxIndex) {
		var newClassNumber = (symbolToClass[currentSymbol] !== undefined) ? symbolToClass[currentSymbol] : '0';
		for (var i=minIndex; i<maxIndex; i++) {
			ChangeBlockAtIndex(i, newClassNumber);
		}
	};

	function updateBrushColor() {
		var newClassNumber = (symbolToClass[currentSymbol] !== undefined) ? symbolToClass[currentSymbol] : '0';
		blocksRoot.selectAll('.brush rect.extent')
			.attr('class', 'extent') // reset classes
			.classed('class'+newClassNumber, true);
	}

	function snapBrush() {
		blocksRoot.selectAll('g.brush')
			.call(brush.extent([Math.floor(brush.extent()[0]), Math.floor(brush.extent()[1])]));
	}

	function clearBrush() {
		oldExtent = null;
		blocksRoot.selectAll('g.brush')
			.call(brush.clear());
	};

	function ExportData() {
		exportTime = new Date().getTime();
		exportedData = {};
		exportedData.metadata = {
			trackURL:trackURL,
			trackDurationSec:wavesurfer.getDuration(),
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

function classify(selection, classNumber) {
	classNumber = (classNumber !== undefined) ? classNumber : 0;
	for (var i=0; i<=2; i++) {
		selection.classed('class'+i, false)	;
	}
	selection.classed('class'+classNumber, true);
	return selection;
};

function setLoadedClass(state) {
	if (state === 'loaded') {
		d3.select('body').classed('loaded', true);
	} else if (state === 'unloaded') {
		d3.select('body').classed('loaded', false);
	}
}