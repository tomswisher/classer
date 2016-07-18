'use strict';

// Settings
var debug = false;
var logs = false;
var numClasses = 2;
var classToName = {'0':'None', '1':'Laughter', '2':'Speech'};
var minPxPerSec = 20;
var labelsHeight = 20;
var blocksHeight = 50;
var blocksPerSec = 10;
var playbackSpeed = 1.0;
var wsOpts = {
    height        : 128,
    // waveColor     : 'black', //'#999',
    // progressColor : '#999', //'#555',
    // cursorColor   : '#333',
    // cursorWidth   : 1,
    // skipLength    : 2,
    // minPxPerSec   : minPxPerSec, //20,
    // pixelRatio    : window.devicvicePixelRatio,
    fillParent    : false, //true,
    // scrollParent  : false,
    // hideScrollbar : false,
    // normalize     : false,
    // audioContext  : null,
    container     : '#wavesurfer-container', //null,
    // dragSelection : true,
    // loopSelection : true,
    // audioRate     : 1,
    // interact      : true,
    // splitChannels : false,
    // mediaContainer: null,
    // mediaControls : false,
    // renderer      : 'Canvas',
    // backend       : 'WebAudio',
    // mediaType     : 'audio',
    // autoCenter    : true,
};
var wavesurfer;
var trackPromptText = 'Click to choose a track';
// var defaultTrackURL = 'Yoko Kanno & Origa - Inner Universe (jamiemori remix).mp3';
// var defaultTrackURL = '08 Smashed Pennies.m4a';
var defaultTrackURL = '08_smashed_pennies_(m4a)_0.wav';
var exportedData, blocksData, brushes, brushNodes, blocksRects, labelsData;
var startTime, exportTime, oldTime, oldSecondsFloat, secondsFloat;
var currentGroupIndex, currentBrushExtent, currentSymbol, keyActivated, isBrushing;
// var zoomValue;
var keyToSymbol = {
	// 32:' ',
	48:'0',49:'1',50:'2',51:'3',52:'4',53:'5',54:'6',55:'7',56:'8',57:'9',
	65:'A',66:'B',67:'C',68:'D',69:'E',70:'F',71:'G',72:'H',73:'I',74:'J',75:'K',76:'L',77:'M',78:'N',79:'O',80:'P',81:'Q',82:'R',83:'S',84:'T',85:'U',86:'V',87:'W',88:'X',89:'Y',90:'Z',
	// 188:',',190:'.',
};
var letterArray = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
var numberArray = ['0','1','2','3','4','5','6','7','8','9'];
var trackURL;
if (sessionStorage.trackURL === undefined) {
	trackURL = defaultTrackURL;
	sessionStorage.setItem('trackURL', trackURL);
} else {
	trackURL = sessionStorage.trackURL;
}
if (debug) { d3.selectAll('.debug').classed('debug', false); }
ReInitWaveSurfer();

function ReInitWaveSurfer() {
	wavesurfer = WaveSurfer.create(wsOpts);
	// d3.select('#wavesurfer-container')
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
		.text((trackURL !== defaultTrackURL) ? trackURL : trackPromptText)
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
			d3.select('#wavesurfer-container svg').remove();
			requestAnimationFrame(function() {
				ReInitWaveSurfer();
				d3.select('#track-url-value').text(trackURL);
				// assumes you put audio in folder /static/audio
				wavesurfer.load('../static/audio/'+trackURL);
			});
		});
	d3.select('#track-clear-button')
		.on('click', function() {
			trackURL = defaultTrackURL;
			sessionStorage.setItem('trackURL', defaultTrackURL);
			d3.select('#track-url-value').text(trackPromptText);
			setLoadedClass('unloaded');
			$(document).off();
			wavesurfer.destroy();
			requestAnimationFrame(function() {
				ReInitWaveSurfer();
			});
		});
};

function Main() {
	oldTime = 0;
	oldSecondsFloat = 0;
	secondsFloat = 0;
	currentGroupIndex = 0;
	// var wsZoomScale = d3.scale.linear()
	// 	.domain([1,2])
	// 	.range([wavesurfer.drawer.params.minPxPerSec, 2*wavesurfer.drawer.params.minPxPerSec]);
	// zoomValue = Number(d3.select('#zoom-slider').node().value);
	// minPxPerSec = wsZoomScale(zoomValue);
	// wavesurfer.zoom(minPxPerSec); // this is not initialized by WaveSurfer for some reason
	// d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
	startTime = new Date().getTime();
	var numSeconds = Math.ceil(wavesurfer.getDuration());
	var waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	var waveNode = d3.select('#wavesurfer-container').select('wave')
		.style('width', waveformWidth+'px')
		.style('height', wsOpts.height+'px');
	
	var svg = d3.select('#svg-container svg')
		.attr('width', waveformWidth+10*2)
		.attr('height', labelsHeight+2*blocksHeight+2*(numClasses-1)+1)
		.select('g')
			.attr('transform', 'translate(10,0)');
	svg.selectAll('*').remove();
	
	labelsData = d3.range(numSeconds+1);
	var secondLabels = svg.selectAll('text.label').data(labelsData);
	secondLabels.enter().append('text')
		.classed('label', true)
		.attr('x', function(d) { return d*minPxPerSec; })
		.attr('y', 0.5*labelsHeight)
		.text(function(d) { return d; });
		// .text(function(d) { return (d === 0) ? '' : d; });

	blocksData = [];
	for (var groupIndex=0; groupIndex<numClasses; groupIndex++) {
		blocksData[groupIndex] = d3.range(numSeconds*blocksPerSec)
			.map(function(d) { return {class:'0', time:(d/blocksPerSec)}; });
	}

	var xScale = d3.scale.linear()
		.domain([0, blocksData[0].length-1])
		.range([0, waveformWidth]);

	isBrushing = false;
	brushes = [];
	brushNodes = [];
	var oldExtents = [];

	blocksRects = [];
	var blocksRoots = svg.selectAll('g.blocks-origin').data(blocksData).enter().append('g')
		.classed('blocks-origin', true)
		.attr('transform', function(d,i) { return 'translate(0,'+(labelsHeight+i*(blocksHeight+1*i))+')'; })
		.each(function(d,groupIndex) {
			blocksRects[groupIndex] = d3.select(this).selectAll('rect.block').data(d);
			blocksRects[groupIndex].enter().append('rect')
				.attr('class', function(d) { return 'block class'+d.class; })
				.attr('x', function(d,i) { return i*minPxPerSec/blocksPerSec; })
				.attr('y', 1)
				.attr('width', minPxPerSec/blocksPerSec)
				.attr('height', blocksHeight);
			oldExtents[groupIndex] = [0,0];
			brushes[groupIndex] = d3.svg.brush()
				.x(xScale)
				.on('brushstart', function() {
					if (logs) console.log(i);
					oldExtents[groupIndex] = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];
					// if (logs) console.log('brushstart', oldExtents[groupIndex], brushes[groupIndex].extent());
				})
				.on('brush', function() {
					snapBrush(groupIndex);
					// if (logs) console.log('brush     ', oldExtents[groupIndex], brushes[groupIndex].extent());
					if (isBrushing === false) {
						var ext = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];
						if (ext[0] !== oldExtents[groupIndex][0] 
							&& ext[1] !== oldExtents[groupIndex][1] 
							&& ext[1]-ext[0] !== oldExtents[groupIndex][1]-oldExtents[groupIndex][0]) {
								applyBrush(groupIndex, isClassedSymbol(currentSymbol), oldExtents[groupIndex][0], oldExtents[groupIndex][1]);
						}
						isBrushing = true;
					}
					oldExtents[groupIndex] = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];
				})
				.on('brushend', function() {
					// if (logs) console.log('brushend  ', oldExtents[groupIndex], brushes[groupIndex].extent());
					isBrushing = false;
					// oldExtents[groupIndex] = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];
					// if (brushes[groupIndex].extent()[0] !== oldExtents[groupIndex][0] && brushes[groupIndex].extent()[1] !== oldExtents[groupIndex][1]) {
					// 	willApplyBrush = true;
					// }
					// var brushExtentDiff = brushes[groupIndex].extent()[1]-brushes[groupIndex].extent()[0];
					// if (brushExtentDiff > 1) {
					// 	oldExtents[groupIndex] = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];	
					// }
					// if (logs) console.log('brushend', brushes[groupIndex].extent(), oldExtents[groupIndex], brushExtentDiff);
				});
			brushNodes[groupIndex] = d3.select(this).append('g')
				.attr('class', 'brush')
				// .attr('transform', 'translate(0,'+(labelsHeight+groupIndex*blocksHeight)+')')
				.call(brushes[groupIndex]);
			brushNodes[groupIndex].selectAll('rect')
				.attr('y', 1)
				.attr('height', blocksHeight-1);
			if (groupIndex === 0) {
				currentBrushExtent = brushNodes[0].selectAll('rect.extent');
			}
			d3.select(this).append('rect')
				.classed('group-guard', true)
				.classed('current', (groupIndex===0))
				.attr('x', 0)
				.attr('y', 1)
				.attr('width', waveformWidth)
				.attr('height', blocksHeight)
				.on('click', function() {
					d3.selectAll('rect.group-guard').classed('current', false);
					d3.select(this).classed('current', true);
					currentGroupIndex = groupIndex;
					currentBrushExtent = brushNodes[currentGroupIndex].selectAll('rect.extent');
					clearBrushes();
				});
		});

	wavesurfer.on('audioprocess', function(time) {
		// Fires continuously as the audio plays. Also fires on seeking.
		if (time < oldTime) { return; } // bug in audioprocess that sets time to 0.xxx secondsFloat
		oldTime = time;
		secondsFloat = Math.floor(10*time)/10;
		if (secondsFloat !== oldSecondsFloat) {
			oldSecondsFloat = secondsFloat;
			updateBlocks('audioprocess');
		}
	});
	wavesurfer.on('seek', function(progress) {
		// On seeking. Callback will receive (float) progress [0..1].
		oldTime = progress*wavesurfer.getDuration();
		secondsFloat = Math.floor(10*oldTime)/10;
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		// updateBlocks('seek');
	});
	wavesurfer.on('finish', function() {
		// – When it finishes playing.
		d3.select('#reset-ws-button').on('mousedown')();
	});
	// wavesurfer.on('zoom', function(minPxPerSec) {
	// 	On zooming. Callback will receive (integer) minPxPerSec.
	// });
	// wavesurfer.on('error', function(a, b, c, d, e, f) {
	// 	// Occurs on error. Callback will receive (string) error message.
	// 	if (logs) console.log('error');
	// 	if (logs) console.log(a, b, c, d, e, f);
	// });
	// wavesurfer.on('pause', function() {
	// 	// When audio is paused.
	// 	if (logs) console.log('pause');
	// });
	// wavesurfer.on('play', function() {
	// 	// When play starts.
	// 	if (logs) console.log('play');
	// });
	// wavesurfer.on('scroll', function(scrollEvent) {
	// 	// When the scrollbar is moved. Callback will receive a ScrollEvent object.
	// 	if (logs) console.log('scroll');
	// 	if (logs) console.log(scrollEvent);
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
		});

	// var manualModeText    = 'Manual (click + drag to add a class)';
	// var automaticModeText = 'Automatic (click to jump in time)';
	// d3.select('#interaction-mode-text').text(automaticModeText);
	// d3.select('#interaction-mode-button')
	// 	.on('mousedown', function() {
	// 		clearBrushes();
	// 		if (brushEnabled === false) {
	// 			brushEnabled = true;
	// 			window._disable_wavesurfer_seek = true;
	// 			d3.select('#wavesurfer-container').classed('brush-enabled', true);
	// 			d3.select('.brush').classed('brush-disabled', false);
	// 			d3.select('#interaction-mode-text').text(manualModeText);
	// 		} else {
	// 			brushEnabled = false;
	// 			window._disable_wavesurfer_seek = false;
	// 			d3.select('#wavesurfer-container').classed('brush-enabled', false);
	// 			d3.select('.brush').classed('brush-disabled', true);
	// 			d3.select('#interaction-mode-text').text(automaticModeText);
	// 		}
	// 		// if (logs) console.log('brushEnabled = '+brushEnabled);
	// 	});

    d3.select('#speed-slider')
        .on('change', function() {
        	clearBrushes();
            playbackSpeed = this.value;
            d3.select('#speed-value').text(parseFloat(playbackSpeed).toFixed(1));
            wavesurfer.setPlaybackRate(playbackSpeed);
            updateBlocks('speed-slider');
        });

	// d3.select('#zoom-slider')
	// 	.on('change', function() {
	// 		clearBrushes();
 //            updateBlocks('zoom-sliderStart');
	// 		zoomValue = Number(this.value);
	// 		minPxPerSec = wsZoomScale(zoomValue);
	// 		wavesurfer.zoom(minPxPerSec);
	// 		d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
	// 		waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	// 		xScale.range([0, waveformWidth]);
	// 		svg.attr('width', waveformWidth);
	// 		blocksRects
	// 			.attr('transform', function(d,i) {
	// 				var xT = i*minPxPerSec/blocksPerSec;
	// 				var yT = 0;
	// 				return 'translate('+xT+','+yT+')';
	// 			})
	// 			.each(function(d) {
	// 				d3.select(this).selectAll('rect')
	// 					.attr('width', minPxPerSec/blocksPerSec);
	// 				// d3.select(this).selectAll('text')
	// 				// 	.attr({
	// 				// 		x: 0.5*minPxPerSec/blocksPerSec,
	// 				// 	});
	// 			});
	// 		secondLabels
	// 			.attr({
	// 				x: function(d) { return d*minPxPerSec; },
	// 			});
 //            updateBlocks('zoom-sliderEnd');
	// 	});

	d3.select('#export-data-button')
		.on('mousedown', function() {
			exportData();
		});

	var classHistoryData = [], currentString = '';
	var classCounters = {'0':blocksData[0].length, '1':0, '2':0};
	d3.select('#class-counters')
		.text('0:'+classCounters['0']+' 1:'+classCounters['1']+' 2:'+classCounters['2'])

	keyActivated = false;
	currentSymbol = undefined;

	$(document)
		.on('keydown', onKeydown)
		.on('keyup', onKeyup);

	requestAnimationFrame(function() {
		updateBlocks();
	});

	function onKeydown(event) {
		if (d3.select(document.activeElement.parentElement).classed('settings') === true) { return; }
		// if (event.shiftKey === true) {
		// 	d3.select('#interaction-mode-button').on('mousedown')();
		// 	return;
		// }
		if (event.which === 32) { // space
			event.preventDefault(); // disable normal key events outside of settings
			d3.select('#play-pause-ws-button').on('mousedown')();
			return;
		}
		var newSymbol = keyToSymbol[event.which];
		// if (logs) console.log(keyActivated, currentSymbol, newSymbol);
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
		updateBlocks('keydown');
	};

	function onKeyup(event) {
		keyActivated = true;
		if (event.which !== 16) { // not shift
			updateBlocks('keyup');
		}
	};

	function isClassedSymbol(symbol) {
		if (symbol === 'Z') {
			return true;
		} else {
			return false;
		}
	};

	function getClassNumber(groupIndex, isClassed) {
		var newClassNumber = '0';
		if (isClassed && groupIndex === 0) {
			newClassNumber = '1';
		} else if (isClassed && groupIndex === 1) {
			newClassNumber = '2';
		}
		return newClassNumber;
	};

	function changeBlock(groupIndex, isClassed, blocksIndex) {
		var block = d3.select(blocksRects[groupIndex][0][blocksIndex]);
        var oldClassNumber = block.datum()['class'];
        var newClassNumber = getClassNumber(groupIndex, isClassed);
        blocksData[groupIndex][blocksIndex].class = newClassNumber;
		block
			.datum({'class':newClassNumber})
			.attr('class', function(d) { return 'block class'+d.class; });
			// .attr('y', function(d,i) { return (parseInt(newClassNumber) === 2) ? blocksHeight : 0; });
		// if (logs) console.log(secondsFloat+'\t'+source);
        classCounters[oldClassNumber] -= 1;
        classCounters[newClassNumber] += 1;
        d3.select('#class-counters')
            .text('0:'+classCounters['0']+'\t1:'+classCounters['1']+'\t2:'+classCounters['2'])
	};

	function applyBrush(groupIndex, isClassed, minIndex, maxIndex) {
		for (var blocksIndex=minIndex; blocksIndex<maxIndex; blocksIndex++) {
			changeBlock(groupIndex, isClassed, blocksIndex);
		}
	};

	function updateBrushColor(groupIndex, isClassed) {
		var newClassNumber = getClassNumber(groupIndex, isClassed);
		svg.selectAll('.brush rect.extent')
			.attr('class', 'extent') // reset classes
			.classed('class'+newClassNumber, true);
	};

	function snapBrush(groupIndex) {
		brushNodes[groupIndex]
			.call(brushes[groupIndex].extent([
				Math.floor(brushes[groupIndex].extent()[0]), Math.floor(brushes[groupIndex].extent()[1])
			]));
	};

	function clearBrushes() {
		for (var groupIndex=0; groupIndex<numClasses; groupIndex++) {
			oldExtents[groupIndex] = null;
			brushNodes[groupIndex].call(brushes[groupIndex].clear());
		}
	};

	function exportData() {
		exportTime = new Date().getTime();
		exportedData = {};
		exportedData.metadata = {
			trackURL: trackURL,
			trackDurationSec: wavesurfer.getDuration(),
			blocksPerSec: blocksPerSec,
			classCounters: classCounters,
			startTime: startTime,
			exportTime: exportTime,
			elapsedSec: (exportTime-startTime)/1000,
			classToName: classToName,
			playbackSpeed: playbackSpeed,
			// zoomValue: zoomValue,
		};
		exportedData.blocksData = blocksData;
		if (logs) console.log(exportedData.metadata);
		if (logs) console.log(exportedData.blocksData);
		$.ajax({
			type: 'POST',
			url: 'exportedData',
			dataType: 'json',
			data: JSON.stringify(exportedData),
            async: false,
			success: function() {
                if (logs) console.log('success');
            },
		});
	};

	function updateBlocks(source) {
		if (d3.select('body').classed('loaded') === false) { return; }
		// if (logs) console.log('update '+source);
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		var brushDrawn = currentBrushExtent.attr('width') > 0;
		if (brushDrawn === true) {
			updateBrushColor(currentGroupIndex, isClassedSymbol(currentSymbol));
		}
		if (currentSymbol === undefined) {
			d3.select('#key-pressed').text('\u00A0');
			d3.selectAll('#key-color').call(classify, 0);
		} else {
			d3.select('#key-pressed').text(currentSymbol);
			d3.selectAll('#key-color').call(classify, getClassNumber(currentGroupIndex, isClassedSymbol(currentSymbol)));
		}
		if (brushDrawn === false) {
	        var blocksIndex = parseInt(secondsFloat*blocksPerSec);
	        changeBlock(currentGroupIndex, isClassedSymbol(currentSymbol), blocksIndex);
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
	    		playbackSpeed:playbackSpeed,
	    		// zoomValue:zoomValue,
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
	    };
	};
};

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
};