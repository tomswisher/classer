'use strict';

// Settings
var logs = true;
var debug = false;
var symbolToGroup = {};
var groups = [
	{'symbol':'X', 'name':'Laughter',},
	{'symbol':'C', 'name':'Speech',  },
	{'symbol':'V', 'name':'Clapping',},
];
groups.forEach(function(d, i) {
	d.color = d3.select('span.color-ref.group'+i).style('color');
	symbolToGroup[d['symbol']] = i;
});
var minPxPerSec = 20;
var secondsHeight = 20;
var blocksHeight = 50;
var blocksPerSec = 10;
var brushMargin = 2;
var playbackSpeed = 1.0;
var wavesurferOpts = {
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
var body = d3.select('body');
var trackLoadButton = body.select('#track-load-button');
var trackClearButton = body.select('#track-clear-button');
var trackURLLabel = body.select('#track-url-label');
var trackInput = body.select('#track-input');
var loadingValueLabel = body.select('#loading-label');
var wavesurferContainer = body.select('#wavesurfer-container');

var svgsContainer = body.select('#svgs-container');
var secondsSvg, secondsData;
var blocksSvgs, blocksData, blocksRects;
var brushes, brushNodes, oldExtent;

var playPauseButton = body.select('#play-pause-button');
var currentTimeLabel = body.select('#current-time-label');
var stopButton = body.select('#stop-button');
var keyPressedLabel = body.select('#key-pressed-label');
// var zoomSlider = body.select('#zoom-slider');
// var zoomLabel = body.select('#zoom-label');
var speedLabel = body.select('#speed-label');
var speedSlider = body.select('#speed-slider');
var exportDataButton = body.select('#export-data-button');
var debugContainer = body.select('#debug-container');

var startTime, exportTime, oldTime, oldSecondsFloat, secondsFloat;
var currentGroupIndex, currentSymbol, keyActivated, switchingIndex;
var exportedData;
// var zoomValue;
var keyToSymbol = {
	// 32:' ',
	48:'0',49:'1',50:'2',51:'3',52:'4',53:'5',54:'6',55:'7',56:'8',57:'9',
	65:'A',66:'B',67:'C',68:'D',69:'E',70:'F',71:'G',72:'H',73:'I',74:'J',75:'K',76:'L',77:'M',78:'N',79:'O',80:'P',81:'Q',82:'R',83:'S',84:'T',85:'U',86:'V',87:'W',88:'X',89:'Y',90:'Z',
	// 188:',',190:'.',
};
var letterArray = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
var numberArray = ['0','1','2','3','4','5','6','7','8','9'];

// Scales
var blocksIndexToPx = d3.scale.linear();
var blocksIndexToBrushIndex = d3.scale.linear();
var brushIndexToBlocksIndex = d3.scale.linear();

var trackPromptText = 'Click to choose a track';
// var defaultTrackURL = 'Yoko Kanno & Origa - Inner Universe (jamiemori remix).mp3';
// var defaultTrackURL = '08 Smashed Pennies.m4a';
var defaultTrackURL = '08_smashed_pennies_(m4a)_7.wav';
var trackURL;
if (sessionStorage.trackURL === undefined) {
	trackURL = defaultTrackURL;
	sessionStorage.setItem('trackURL', trackURL);
} else {
	trackURL = sessionStorage.trackURL;
}

var wavesurfer = WaveSurfer.create(wavesurferOpts);
wavesurfer.on('loading', function(a) {
	// Fires continuously when loading via XHR or drag'n'drop. Callback will receive (integer) loading progress in percents [0..100] and (object) event target.
	// loadingValueLabel.text('Loading at '+a+'%');
	loadingValueLabel.text('Loading...');
});
wavesurfer.on('error', function(xhrError) {
	// Occurs on error. Callback will receive (string) error message.
	loadingValueLabel.text('Error loading '+trackURL);
});
wavesurfer.on('ready', function() {
	// When audio is loaded, decoded and the waveform drawn.
	// SetLoadedClass('loaded');
	loadingValueLabel.text('');
	Main();
});

loadingValueLabel.text('');
trackLoadButton
	.on('click', function() {
		SetLoadedClass('unloaded');
		$(document).off();
		svgsContainer.selectAll('*').remove();
		loadingValueLabel.text('');
		trackURLLabel.text(trackURL);
		// assumes you put audio in folder /static/audio
		wavesurfer.load('../static/audio/'+trackURL);
		requestAnimationFrame(function() {
			console.log(window.performance.memory);
		});
	});
trackClearButton
	.on('click', function() {
		SetLoadedClass('unloaded');
		stopButton.on('mousedown')();
		$(document).off();
		svgsContainer.selectAll('*').remove();
		loadingValueLabel.text('');
		trackURLLabel.text(trackPromptText);
		trackURL = defaultTrackURL;
		sessionStorage.setItem('trackURL', defaultTrackURL);
	});
trackURLLabel
	.text((trackURL !== defaultTrackURL) ? trackURL : trackPromptText)
	.on('click', function() {
		trackInput.node().click();
	});
trackInput
    .on('change', function() {
    	trackURL = this.files[0].name;
    	sessionStorage.setItem('trackURL', trackURL);
    	trackURLLabel.text(trackURL);
    });

if (debug) { debugContainer.classed('hidden', false); }


// ---------------------------------------------------------------------


function SetLoadedClass(state) {
	if (state === 'loaded') {
		body.classed('loaded', true);
	} else if (state === 'unloaded') {
		body.classed('loaded', false);
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
	// zoomValue = Number(zoomSlider.node().value);
	// minPxPerSec = wsZoomScale(zoomValue);
	// wavesurfer.zoom(minPxPerSec); // this is not initialized by WaveSurfer for some reason
	// zoomLabel.text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
	startTime = new Date().getTime();
	var waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	wavesurferContainer.selectAll('wave')
		.style('width', waveformWidth+'px')
		.style('height', wavesurferOpts.height+'px');

	var numSeconds = Math.ceil(wavesurfer.getDuration());
	secondsData = d3.range(numSeconds+1);
	secondsSvg = svgsContainer.append('svg')
		.attr('class', 'seconds-svg')
		.attr('width', waveformWidth+10*2)
		.attr('height', secondsHeight)
		.append('g')
			.attr('class', 'text-origin')
			.attr('transform', 'translate(10,0)');
	var secondLabels = secondsSvg.selectAll('text.label').data(secondsData);
	secondLabels.enter().append('text')
		.classed('label', true)
		.attr('x', function(d) { return d*minPxPerSec; })
		.attr('y', 0.5*secondsHeight)
		.text(function(d) { return d; });

	blocksData = [];
	for (var groupIndex=0; groupIndex<(groups.length); groupIndex++) {
		blocksData[groupIndex] = d3.range(numSeconds*blocksPerSec)
			.map(function(d) { return {'classified':false, 'time':(d/blocksPerSec)}; });
	}
	blocksIndexToPx
		.domain([0, blocksData[0].length])
		.range([0, waveformWidth]);
	oldExtent = null;
	brushes = [];
	brushNodes = [];
	keyActivated = false;
	switchingIndex = null;
	currentSymbol = undefined;
	blocksRects = [];
	blocksSvgs = svgsContainer.selectAll('svg.blocks-svg').data(blocksData).enter().append('svg')
		.attr('class', 'blocks-svg')
		.attr('tabindex', function(d, i) { return i+1; })
		.attr('width', waveformWidth)
		.attr('height', blocksHeight)
		.each(function(d, groupIndex) {
			blocksRects[groupIndex] = d3.select(this).selectAll('rect.block').data(d).enter().append('rect')
				.attr('class', function(d) { return 'block group'+groupIndex; })
				.attr('x', function(d, i) { return i*minPxPerSec/blocksPerSec; })
				.attr('y', 0)
				.attr('width', minPxPerSec/blocksPerSec)
				.attr('height', blocksHeight);
			// d3.select(this).append('rect')
			// 	.classed('group-marker', true)
			// 	.classed('current', (groupIndex===0))
			// 	.attr('x', 0)
			// 	.attr('y', 1)
			// 	.attr('width', waveformWidth)
			// 	.attr('height', blocksHeight);
			// oldExtents[groupIndex] = [0,0];
			brushes[groupIndex] = d3.svg.brush()
				.x(blocksIndexToPx)
				.on('brushstart', function() {
					if (currentGroupIndex !== groupIndex) {
						SwitchGroup(groupIndex);
						// SwitchBrush(currentGroupIndex);
						return;
					}
					var brush = brushes[currentGroupIndex];
					if (logs) console.log(currentGroupIndex+'\tbrushstart', IsClasserSymbol(currentSymbol)+'\t', (brush.empty()?'empty':'full '), oldExtent!==null+'\t', brush.extent());
				})
				.on('brush', function() {
					var brush = brushes[currentGroupIndex];
					SnapBrush(groupIndex, Math.round(brush.extent()[0]), Math.round(brush.extent()[1]));
					// var resizeDisplay = brushNodes[currentGroupIndex].selectAll('.resize').style('display');
					// console.log(resizeDisplay);
					if (brush.empty() && oldExtent !== null && oldExtent[0] !== oldExtent[1]) {
						if (logs) console.log(currentGroupIndex+'\tbrush     ', IsClasserSymbol(currentSymbol)+'\t', (brush.empty()?'empty':'full '), oldExtent!==null+'\t', brush.extent());
						ChangeBlocks(currentGroupIndex, oldExtent[0], oldExtent[1], IsClasserSymbol(currentSymbol));
					}
					oldExtent = [brush.extent()[0], brush.extent()[1]];
					// if (logs) console.log(currentGroupIndex+'\tbrush     ', IsClasserSymbol(currentSymbol)+'\t', (brush.empty()?'empty':'full '), oldExtent!==null+'\t', brush.extent());
					// if (!isBrushing && !blocksData[groupIndex][brush.extent()[0]].classified) {
					// 	if (logs) console.log(groupIndex, 'unclassified');
					// 	ClearBrushes();
					// 	return;
					// } else {
					// 	if (logs) console.log(groupIndex, 'classified');
					// }
					// if (isBrushing === false) {
					// 	if (logs) console.log('brush     ', brush.extent());
					// 	ExpandBrush(groupIndex, brush.extent()[0]);
					// 	var ext = [brush.extent()[0], brush.extent()[1]];
					// 	if (ext[0] !== oldExtents[groupIndex][0] 
					// 		&& ext[1] !== oldExtents[groupIndex][1] 
					// 		&& ext[1]-ext[0] !== oldExtents[groupIndex][1]-oldExtents[groupIndex][0]) {
					// 			ChangeBlocks(groupIndex, oldExtents[groupIndex][0], oldExtents[groupIndex][1], IsClasserSymbol(currentSymbol));
					// 	}
					// 	isBrushing = true;
					// }
					// oldExtents[groupIndex] = [brush.extent()[0], brush.extent()[1]];
				})
				.on('brushend', function() {
					var brush = brushes[currentGroupIndex];
					if (logs) console.log(currentGroupIndex+'\tbrushend  ', IsClasserSymbol(currentSymbol)+'\t', (brush.empty()?'empty':'full '), oldExtent!==null+'\t', brush.extent());

					// var currentExtent = brushes[currentGroupIndex].extent();
					// ChangeBlocks(currentGroupIndex, currentExtent[0], currentExtent[1], IsClasserSymbol(currentSymbol));

					// if (logs) console.log('brushend  ', oldExtents[groupIndex], brush.extent());
					// isBrushing = false;
					// oldExtents[groupIndex] = [brush.extent()[0], brush.extent()[1]];
					// if (brush.extent()[0] !== oldExtents[groupIndex][0] && brush.extent()[1] !== oldExtents[groupIndex][1]) {
					// 	willChangeBlocks = true;
					// }
					// var brushExtentDiff = brush.extent()[1]-brush.extent()[0];
					// if (brushExtentDiff > 1) {
					// 	oldExtents[groupIndex] = [brush.extent()[0], brush.extent()[1]];	
					// }
					// if (logs) console.log('brushend', brushes[groupIndex].extent(), oldExtents[groupIndex], brushExtentDiff);
				});
			brushNodes[groupIndex] = d3.select(this).append('g')
				.attr('class', 'brush brushdisabled group'+groupIndex)
				.call(brushes[groupIndex]);
			brushNodes[groupIndex].selectAll('rect')
				.attr('y', 0.5*brushMargin)
				.attr('height', blocksHeight-2*0.5*brushMargin)
				.style('stroke-width', brushMargin);
		});

	wavesurfer.on('audioprocess', function(time) {
		// Fires continuously as the audio plays. Also fires on seeking.
		if (time < oldTime) { return; } // bug in audioprocess that sets time to 0.xxx secondsFloat
		oldTime = time;
		secondsFloat = Math.round(10*time)/10;
		if (secondsFloat === wavesurfer.getDuration()) {
			stopButton.on('mousedown')();
			return;
		}
		if (secondsFloat !== oldSecondsFloat) {
			oldSecondsFloat = secondsFloat;
			UpdateBlocks('audioprocess');
		}
	});
	wavesurfer.on('seek', function(progress) {
		// On seeking. Callback will receive (float) progress [0..1].
		oldTime = progress*wavesurfer.getDuration();
		secondsFloat = Math.round(10*oldTime)/10;
		currentTimeLabel.text(secondsFloat.toFixed(1)+' s');
		// UpdateBlocks('seek');
	});
	wavesurfer.on('finish', function() {
		// – When it finishes playing.
		stopButton.on('mousedown')();
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

	playPauseButton
        .text('Play')
		.on('mousedown', function() {
			wavesurfer.playPause();
			playPauseButton
				.text((wavesurfer.backend.isPaused() === true) ? 'Play' : 'Pause');
		});

	stopButton
		.on('mousedown', function() {
			if (wavesurfer.backend.isPaused() === false) {
				playPauseButton.on('mousedown')();
			}
			oldTime = 0;
			secondsFloat = 0;
			wavesurfer.seekTo(secondsFloat);
			currentTimeLabel.text(secondsFloat.toFixed(1)+' s');
			body.select('wave').node().scrollLeft = 0;
		});

    speedSlider
        .on('change', function() {
        	ClearBrushes();
            playbackSpeed = this.value;
            speedLabel.text(parseFloat(playbackSpeed).toFixed(1));
            wavesurfer.setPlaybackRate(playbackSpeed);
            UpdateBlocks('speed-slider');
        });

	// zoomSlider
	// 	.on('change', function() {
	// 		ClearBrushes();
 //            UpdateBlocks('zoom-sliderStart');
	// 		zoomValue = Number(this.value);
	// 		minPxPerSec = wsZoomScale(zoomValue);
	// 		wavesurfer.zoom(minPxPerSec);
	// 		zoomLabel.text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
	// 		waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	// 		blocksIndexToPx.range([0, waveformWidth]);
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

	exportDataButton
		.on('mousedown', function() {
			ExportData();
		});

	$(document)
		.on('keydown', OnKeydown)
		.on('keyup', OnKeyup);

	wavesurfer.seekTo(1);
	wavesurfer.seekTo(0);
	setTimeout(function() {
		SetLoadedClass('loaded');
		UpdateBlocks();
	}, 100);

	function OnKeydown(event) {
		// if (d3.select(document.activeElement.parentElement).attr('id') !== 'key-stage') { return; }
		// if (logs) console.log('OnKeydown', event.which, switchingIndex);
		if (event.which === 32) { // space
			event.preventDefault(); // disable normal key events outside of settings
			playPauseButton.on('mousedown')();
			return;
		}
		if (event.shiftKey === true) {
			event.preventDefault();
			switchingIndex = (currentGroupIndex === 2) ? 0 : currentGroupIndex+1;
		}
		if (event.which === 9) { // tab
			event.preventDefault();
			// switchingIndex = (currentGroupIndex === 0) ? 2 : currentGroupIndex-1;
			switchingIndex = (currentGroupIndex === 2) ? 0 : currentGroupIndex+1;
			// currentGroupIndex = (currentGroupIndex+1)%3;
			// blocksSvgs[0][currentGroupIndex].focus();
			// if (blocksSvgs[0].indexOf(document.activeElement) === -1) {
			// 	console.log('changing');
			// 	currentGroupIndex = 0;
			// 	blocksSvgs[0][0].focus();
			// }
			// return;
			// if (currentGroupIndex === 2) {
			// 	currentGroupIndex = 0;
			// 	blocksSvgs[0][0].focus();
			// } else if (currentGroupIndex === 0)
		}
		var newSymbol = keyToSymbol[event.which];
		if (symbolToGroup[newSymbol] !== undefined) {
			switchingIndex = symbolToGroup[newSymbol];
		}
		if (switchingIndex !== null) {
			SwitchGroup(switchingIndex);
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
		// if (logs) console.log(document.activeElement);
		// if (logs) console.log('OnKeyup  ', event.which, switchingIndex);
		keyActivated = true;
		if (switchingIndex !== null) {
			switchingIndex = null;
			return;
		}
		if (event.which !== 16) { // not shift
			UpdateBlocks('keyup');
		}
	};

	function SwitchGroup(switchingIndex) {
		console.log('SwitchGroup', switchingIndex);
		var currentExtent = brushes[currentGroupIndex].extent();
		ChangeBlocks(currentGroupIndex, currentExtent[0], currentExtent[1], IsClasserSymbol(currentSymbol));
		ClearBrushes();
		currentGroupIndex = switchingIndex;
		switchingIndex = null;
		oldExtent = null;
		blocksSvgs[0][currentGroupIndex].focus();
		UpdateBrushes(currentGroupIndex, IsClasserSymbol(currentSymbol));
	};

	function IsClasserSymbol(symbol) {
		if (symbol === 'Z') {
			return true;
		} else {
			return false;
		}
	};

	function ExpandBrush(groupIndex, blocksIndex) {
		var minIndex = blocksIndex;
		var maxIndex = blocksIndex;
		while (minIndex >= 0 && blocksData[groupIndex][minIndex].classified) {
			minIndex--;
		}
		minIndex++;
		while (maxIndex < blocksData[groupIndex].length && blocksData[groupIndex][maxIndex].classified) {
			maxIndex++;
		}
		maxIndex--;
		if (logs) console.log(groupIndex, minIndex, maxIndex);
		SnapBrush(groupIndex, minIndex, maxIndex);
	};

	function SnapBrush(groupIndex, minIndex, maxIndex) {
		brushNodes[groupIndex]
			.call(brushes[groupIndex].extent([minIndex, maxIndex]));
	};

	// function SwitchBrush(groupIndex) {
	// 	svgsContainer.selectAll('rect.group-marker')
	// 		.classed('current', false)
	// 		.filter(function(d, i) { return i === currentGroupIndex; })
	// 		.classed('current', true);
	// };

	function UpdateBrushes(groupIndex, isClassified) {
		brushNodes[groupIndex]
			.classed('classified', isClassified);
	};

	function ClearBrushes() {
		for (var groupIndex=0; groupIndex<(groups.length); groupIndex++) {
			// oldExtents[groupIndex] = null;
			brushNodes[groupIndex].call(brushes[groupIndex].clear());
		}
	};

	function ChangeBlocks(groupIndex, minIndex, maxIndex, isClassified) {
		console.log('ChangeBlocks', groupIndex, minIndex, maxIndex, isClassified);
		for (var blocksIndex=minIndex; blocksIndex<maxIndex; blocksIndex++) {
			ChangeBlock(groupIndex, blocksIndex, isClassified);
		}
	};

    function ChangeBlock(groupIndex, blocksIndex, isClassified) {
        blocksData[groupIndex][blocksIndex]['classified'] = isClassified;
        d3.select(blocksRects[groupIndex][0][blocksIndex])
        	.classed('classified', isClassified);
    };

	function UpdateKeyPressedLabel() {
		if (currentSymbol === undefined) {
			keyPressedLabel.text('\u00A0');
		} else {
			keyPressedLabel.text(currentSymbol);
		}
	};

	function UpdateBlocks(source) {
		// if (logs) console.log('UpdateBlocks '+source);
		if (body.classed('loaded') === false) { return; }
		// if (logs) console.log('update '+source);
		currentTimeLabel.text(secondsFloat.toFixed(1)+' s');
		UpdateKeyPressedLabel();
		blocksSvgs[0][currentGroupIndex].focus();
		UpdateBrushes(currentGroupIndex, IsClasserSymbol(currentSymbol));
		if (brushes[currentGroupIndex].empty()) {
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

	    	var rows = debugContainer.selectAll('div.plain-text').data(keyValueArray);
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
		// $.ajax({
		// 	type: 'POST',
		// 	url: 'exportedData',
		// 	dataType: 'json',
		// 	data: JSON.stringify(exportedData),
  //           async: false,
		// 	success: function() {
  //               if (logs) console.log('success');
  //           },
		// });
	};
};