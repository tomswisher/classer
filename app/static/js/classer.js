'use strict';

// Settings
var debug = false;
var logs = false;
var groups = [
	{'symbol':'X', 'name':'Laughter', 'color':'blue'},
	{'symbol':'C', 'name':'Speech',   'color':'mediumorchid'},
	{'symbol':'V', 'name':'Clapping', 'color':'orange'},
];
var symbolToGroup = {};
$.each(groups, function(i, d) {
	symbolToGroup[d['symbol']] = i;
});
var minPxPerSec = 20;
var labelsHeight = 20;
var blocksHeight = 75;
var blocksPerSec = 10;
var brushMargin = 4;
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
var numGroups = groups.length;
var wavesurfer;
var trackPromptText = 'Click to choose a track';
// var defaultTrackURL = 'Yoko Kanno & Origa - Inner Universe (jamiemori remix).mp3';
// var defaultTrackURL = '08 Smashed Pennies.m4a';
var defaultTrackURL = '08_smashed_pennies_(m4a)_0.wav';
var exportedData, blocksData, brushes, brushNodes, blocksRects, labelsData;
var startTime, exportTime, oldTime, oldSecondsFloat, secondsFloat;
var svg;
var currentGroupIndex, currentSymbol, keyActivated, switchingIndex, isBrushing;
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
		SetLoadedClass('loaded');
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
			SetLoadedClass('unloaded');
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
			SetLoadedClass('unloaded');
			$(document).off();
			wavesurfer.destroy();
			requestAnimationFrame(function() {
				ReInitWaveSurfer();
			});
		});
};

function SetLoadedClass(state) {
	if (state === 'loaded') {
		d3.select('body').classed('loaded', true);
	} else if (state === 'unloaded') {
		d3.select('body').classed('loaded', false);
	}
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
	
	svg = d3.select('#svg-container svg')
		.attr('width', waveformWidth+10*2)
		.attr('height', labelsHeight+numGroups*(blocksHeight+2)+1)
		.select('g')
			.attr('transform', 'translate(10,0)');
	svg.selectAll('*').remove();
	
	labelsData = d3.range(numSeconds+1);
	var secondLabels = svg.append('g').attr('class', 'text-origin')
		.selectAll('text.label').data(labelsData);
	secondLabels.enter().append('text')
		.classed('label', true)
		.attr('x', function(d) { return d*minPxPerSec; })
		.attr('y', 0.5*labelsHeight)
		.text(function(d) { return d; });
		// .text(function(d) { return (d === 0) ? '' : d; });

	blocksData = [];
	for (var groupIndex=0; groupIndex<numGroups; groupIndex++) {
		blocksData[groupIndex] = d3.range(numSeconds*blocksPerSec)
			.map(function(d) { return {'classified':false, 'time':(d/blocksPerSec)}; });
	}

	var xScale = d3.scale.linear()
		.domain([0, blocksData[0].length-1])
		.range([0, waveformWidth]);

	isBrushing = false;
	brushes = [];
	brushNodes = [];
	var oldExtents = [];

	keyActivated = false;
	switchingIndex = false;
	currentSymbol = undefined;

	blocksRects = [];
	var blocksRoots = svg.selectAll('g.blocks-origin').data(blocksData).enter().append('g')
		.attr('class', 'blocks-origin')
		.attr('transform', function(d, i) { return 'translate(0,'+(labelsHeight+i*(blocksHeight+2))+')'; })
		.each(function(d, groupIndex) {
			blocksRects[groupIndex] = d3.select(this).selectAll('rect.block').data(d).enter().append('rect')
				.attr('class', function(d) { return 'block group'+groupIndex; })
				.attr('x', function(d, i) { return i*minPxPerSec/blocksPerSec; })
				.attr('y', 1)
				.attr('width', minPxPerSec/blocksPerSec)
				.attr('height', blocksHeight);
			d3.select(this).append('rect')
				.classed('group-marker', true)
				.classed('current', (groupIndex===0))
				.attr('x', 0)
				.attr('y', 1)
				.attr('width', waveformWidth)
				.attr('height', blocksHeight);
			oldExtents[groupIndex] = [0,0];
			brushes[groupIndex] = d3.svg.brush()
				.x(xScale)
				.on('brushstart', function() {
					if (currentGroupIndex !== groupIndex) {
						var currentExtent = brushes[currentGroupIndex].extent();
						ApplyBrush(currentGroupIndex, currentExtent[0], currentExtent[1], IsClasserSymbol(currentSymbol));
						ClearBrushes();
						currentGroupIndex = groupIndex;
						UpdateBrushes(currentGroupIndex, IsClasserSymbol(currentSymbol));
					}
					if (logs) console.log(i);
					oldExtents[groupIndex] = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];
					// if (logs) console.log('brushstart', oldExtents[groupIndex], brushes[groupIndex].extent());
				})
				.on('brush', function() {
					SnapBrush(groupIndex);
					// if (logs) console.log('brush     ', oldExtents[groupIndex], brushes[groupIndex].extent());
					if (isBrushing === false) {
						var ext = [brushes[groupIndex].extent()[0], brushes[groupIndex].extent()[1]];
						if (ext[0] !== oldExtents[groupIndex][0] 
							&& ext[1] !== oldExtents[groupIndex][1] 
							&& ext[1]-ext[0] !== oldExtents[groupIndex][1]-oldExtents[groupIndex][0]) {
								ApplyBrush(groupIndex, oldExtents[groupIndex][0], oldExtents[groupIndex][1], IsClasserSymbol(currentSymbol));
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
				.attr('class', 'brush brushdisabled group'+groupIndex)
				.call(brushes[groupIndex]);
			brushNodes[groupIndex].selectAll('rect')
				.attr('y', 1+0.5*brushMargin)
				.attr('height', blocksHeight-2*0.5*brushMargin)
				.style('stroke-width', brushMargin);
		});

	wavesurfer.on('audioprocess', function(time) {
		// Fires continuously as the audio plays. Also fires on seeking.
		if (time < oldTime) { return; } // bug in audioprocess that sets time to 0.xxx secondsFloat
		oldTime = time;
		secondsFloat = Math.floor(10*time)/10;
		if (secondsFloat !== oldSecondsFloat) {
			oldSecondsFloat = secondsFloat;
			UpdateBlocks('audioprocess');
		}
	});
	wavesurfer.on('seek', function(progress) {
		// On seeking. Callback will receive (float) progress [0..1].
		oldTime = progress*wavesurfer.getDuration();
		secondsFloat = Math.floor(10*oldTime)/10;
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		// UpdateBlocks('seek');
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
        .text('Play')
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

    d3.select('#speed-slider')
        .on('change', function() {
        	ClearBrushes();
            playbackSpeed = this.value;
            d3.select('#speed-value').text(parseFloat(playbackSpeed).toFixed(1));
            wavesurfer.setPlaybackRate(playbackSpeed);
            UpdateBlocks('speed-slider');
        });

	// d3.select('#zoom-slider')
	// 	.on('change', function() {
	// 		ClearBrushes();
 //            UpdateBlocks('zoom-sliderStart');
	// 		zoomValue = Number(this.value);
	// 		minPxPerSec = wsZoomScale(zoomValue);
	// 		wavesurfer.zoom(minPxPerSec);
	// 		d3.select('#zoom-value').text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
	// 		waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	// 		xScale.range([0, waveformWidth]);
	// 		svg.attr('width', waveformWidth);
	// 		blocksRects
	// 			.attr('transform', function(d, i) {
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
 //            UpdateBlocks('zoom-sliderEnd');
	// 	});

	d3.select('#export-data-button')
		.on('mousedown', function() {
			ExportData();
		});

	$(document)
		.on('keydown', OnKeydown)
		.on('keyup', OnKeyup);

	requestAnimationFrame(function() {
		UpdateBlocks();
	});

	function OnKeydown(event) {
		if (d3.select(document.activeElement.parentElement).classed('settings') === true) { return; }
		// if (event.shiftKey === true) {
		// 	return;
		// }
		if (event.which === 32) { // space
			event.preventDefault(); // disable normal key events outside of settings
			d3.select('#play-pause-ws-button').on('mousedown')();
			return;
		}
		var newSymbol = keyToSymbol[event.which];
		if (symbolToGroup[newSymbol] !== undefined) {
			switchingIndex = symbolToGroup[newSymbol];
			return;
		}
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
		UpdateBlocks('keydown');
	};

	function OnKeyup(event) {
		keyActivated = true;
		if (event.which !== 16) { // not shift
			UpdateBlocks('keyup');
		}
		if (switchingIndex !== false) {
			if (currentGroupIndex !== switchingIndex) {
				var currentExtent = brushes[currentGroupIndex].extent();
				ApplyBrush(currentGroupIndex, currentExtent[0], currentExtent[1], IsClasserSymbol(currentSymbol));
				ClearBrushes();
			}
			currentGroupIndex = switchingIndex;
			UpdateBrushes(currentGroupIndex, IsClasserSymbol(currentSymbol));
			switchingIndex = false;
		}
	};

	function IsClasserSymbol(symbol) {
		if (symbol === 'Z') {
			return true;
		} else {
			return false;
		}
	};

	function ApplyBrush(groupIndex, minIndex, maxIndex, isClassified) {
		for (var blocksIndex=minIndex; blocksIndex<maxIndex; blocksIndex++) {
			ChangeBlock(groupIndex, blocksIndex, isClassified);
		}
	};

    function ChangeBlock(groupIndex, blocksIndex, isClassified) {
        var block = d3.select(blocksRects[groupIndex][0][blocksIndex]);
        blocksData[groupIndex][blocksIndex]['classified'] = isClassified;
        block
            .classed('classified', isClassified);
    };

	function UpdateBrushes(groupIndex, isClassified) {
		brushNodes[groupIndex]
			.classed('classified', isClassified);
		d3.selectAll('rect.group-marker')
			.classed('current', false);
		d3.selectAll('rect.group-marker').filter(function(d, i) { return i === currentGroupIndex; })
			.classed('current', true);
	};

	function SnapBrush(groupIndex) {
		brushNodes[groupIndex]
			.call(brushes[groupIndex].extent([
				Math.floor(brushes[groupIndex].extent()[0]), Math.floor(brushes[groupIndex].extent()[1])
			]));
	};

	function ClearBrushes() {
		for (var groupIndex=0; groupIndex<numGroups; groupIndex++) {
			oldExtents[groupIndex] = null;
			brushNodes[groupIndex].call(brushes[groupIndex].clear());
		}
	};

	function UpdateKeyPressedLabel() {
		if (currentSymbol === undefined) {
			d3.select('#key-pressed').text('\u00A0');
		} else {
			d3.select('#key-pressed').text(currentSymbol);
		}
	};

	function UpdateBlocks(source) {
		// console.log('UpdateBlocks '+source);
		if (d3.select('body').classed('loaded') === false) { return; }
		// if (logs) console.log('update '+source);
		d3.select('#current-time').text(secondsFloat.toFixed(1)+'s');
		UpdateKeyPressedLabel();
		UpdateBrushes(currentGroupIndex, IsClasserSymbol(currentSymbol));
		var brushDrawn = brushNodes[currentGroupIndex].selectAll('rect.extent').attr('width') > 0;
		if (!brushDrawn) {
	        var blocksIndex = parseInt(secondsFloat*blocksPerSec);
	        ChangeBlock(currentGroupIndex, blocksIndex, IsClasserSymbol(currentSymbol));
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

	function ExportData() {
		exportTime = new Date().getTime();
		exportedData = {};
		exportedData.metadata = {
			trackURL: trackURL,
			trackDurationSec: wavesurfer.getDuration(),
			blocksPerSec: blocksPerSec,
			startTime: startTime,
			exportTime: exportTime,
			elapsedSec: (exportTime-startTime)/1000,
			groups: groups,
			playbackSpeed: playbackSpeed,
			// zoomValue: zoomValue,
		};
		exportedData.blocksData = blocksData;
		exportedData.blocksDataRefined = [];
		var blocksDataTranspose = blocksData[0].map(function(col, i) {
			return blocksData.map(function(row, j) {
				return row[i];
			});
		});
		$.each(blocksDataTranspose, function(blocksIndex, blockDatum) {
			var classifiedArray = [];
			$.each(blockDatum, function(groupIndex, d) {
				if (d['classified'] === true) { classifiedArray.push(groupIndex); }
			});
			exportedData.blocksDataRefined.push([blockDatum[0].time, classifiedArray]);
		});
		if (logs) console.log(exportedData.metadata);
		if (logs) console.log(exportedData.exportedData.blocksDataRefined);
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
};