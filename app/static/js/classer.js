'use strict';

// Settings
var logs = true;
var debug = false;
var groupsArray = [
	{'name':'Laughter',},
	// {'name':'Speech',  },
	{'name':'Clapping',},
];
groupsArray.forEach(function(d, i) {
	d.color = d3.select('span.color-ref.group'+i).style('color');
});
var minPxPerSec = 20;
var secondsHeight = 20;
var blocksHeight = 60;
var blocksPerSec = 10;
var playbackSpeed = 1.0;
var svgsMargin = 10;
// var brushMargin = 2;
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
var loadingLabel = body.select('#loading-label');
var appContainer = body.select('#app-container');
var wavesurferContainer = body.select('#wavesurfer-container');
var svgsContainer = body.select('#svgs-container');
var secondsSvg;
var blocksSvgs, blocksData, blocksRects;
var playPauseButton = body.select('#play-pause-button');
var currentTimeLabel = body.select('#current-time-label');
var stopButton = body.select('#stop-button');
// var keyPressedLabel = body.select('#key-pressed-label');
// var zoomSlider = body.select('#zoom-slider');
// var zoomLabel = body.select('#zoom-label');
var speedLabel = body.select('#speed-label');
var speedSlider = body.select('#speed-slider');
var exportDataButton = body.select('#export-data-button');
var debugContainer = body.select('#debug-container');
var playerLine = body.select('#player-line');

var wavePlaying;
document.querySelector('wave wave')

var waveformWidth, numSeconds, startTime, exportTime, oldTime, oldSecondsFloat, secondsFloat, exportedData;
var symbols;
// var zoomValue;
// var brushes, brushNodes, oldExtent, isResizing;
// var blocksIndexToPx = d3.scale.linear();
// var keyToSymbol = {
// 	// 32:' ',
// 	48:'0',49:'1',50:'2',51:'3',52:'4',53:'5',54:'6',55:'7',56:'8',57:'9',
// 	65:'A',66:'B',67:'C',68:'D',69:'E',70:'F',71:'G',72:'H',73:'I',74:'J',75:'K',76:'L',77:'M',78:'N',79:'O',80:'P',81:'Q',82:'R',83:'S',84:'T',85:'U',86:'V',87:'W',88:'X',89:'Y',90:'Z',
// 	// 188:',',190:'.',
// };
var letterArray = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
var numberArray = ['0','1','2','3','4','5','6','7','8','9'];

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
	// loadingLabel.text('Loading at '+a+'%');
	loadingLabel.text('Loading...');
});
wavesurfer.on('error', function(xhrError) {
	// Occurs on error. Callback will receive (string) error message.
	loadingLabel.text('Error in loading '+trackURL);
});
wavesurfer.on('ready', function() {
	// When audio is loaded, decoded and the waveform drawn.
	// SetLoadedClass('loaded');
	loadingLabel.text('Hold Z to apply class, X to remove class, and Shift/Tab to switch class rows');
	Main();
});

loadingLabel.text('');
trackLoadButton
	.on('mousedown', function() {
		SetLoadedClass('unloaded');
		$(document).off();
		svgsContainer.selectAll('*').remove();
		loadingLabel.text('');
		trackURLLabel.text(trackURL);
		// assumes you put audio in folder /static/audio
		wavesurfer.load('../static/audio/'+trackURL);
	});
trackClearButton
	.on('mousedown', function() {
		SetLoadedClass('unloaded');
		stopButton.on('mousedown')();
		$(document).off();
		svgsContainer.selectAll('*').remove();
		loadingLabel.text('');
		trackURLLabel.text(trackPromptText);
		trackURL = defaultTrackURL;
		sessionStorage.setItem('trackURL', defaultTrackURL);
	});
trackURLLabel
	.text((trackURL !== defaultTrackURL) ? trackURL : trackPromptText)
	.on('mousedown', function() {
		if (!wavesurfer.backend.isPaused()) {
			playPauseButton.on('mousedown')();
		}
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
	numSeconds = Math.ceil(wavesurfer.getDuration());
	// var wsZoomScale = d3.scale.linear()
	// 	.domain([1,2])
	// 	.range([wavesurfer.drawer.params.minPxPerSec, 2*wavesurfer.drawer.params.minPxPerSec]);
	// zoomValue = Number(zoomSlider.node().value);
	// minPxPerSec = wsZoomScale(zoomValue);
	// wavesurfer.zoom(minPxPerSec); // this is not initialized by WaveSurfer for some reason
	// zoomLabel.text(zoomValue.toFixed(1)+' ('+parseInt(minPxPerSec)+'\tpixels/s)');
	startTime = new Date().getTime();
	waveformWidth = Math.ceil(minPxPerSec*wavesurfer.getDuration());
	appContainer.style('width', waveformWidth+2*10+'px');
	wavesurferContainer.selectAll('wave')
		.style('width', waveformWidth+'px')
		.style('height', wavesurferOpts.height+'px');
	wavePlaying = wavesurferContainer.select('wave wave');

	blocksData = [];
	for (var groupIndex=0; groupIndex<(groupsArray.length); groupIndex++) {
		blocksData[groupIndex] = d3.range(numSeconds*blocksPerSec)
			.map(function(d) { return {'classified':false, 'time':(d/blocksPerSec)}; });
	}
	symbols = [];
	blocksRects = [];
	// isResizing = false;
	// oldExtent = null;
	// brushes = [];
	// brushNodes = [];
	// blocksIndexToPx
	// 	.domain([0, blocksData[0].length])
	// 	.range([0, waveformWidth]);
	blocksSvgs = svgsContainer.selectAll('svg.blocks-svg').data(blocksData).enter().append('svg')
		.attr('class', 'blocks-svg inlineblock')
		.attr('width', waveformWidth)
		.attr('height', blocksHeight)
		.attr('tabindex', function(d, i) { return 4+i; })
		// .on('mousedown', function(d, groupIndex) {
		// 	SwitchGroup(groupIndex);
		// })	
		.each(function(d, groupIndex) {
			blocksRects[groupIndex] = d3.select(this).selectAll('rect.block').data(d).enter().append('rect')
				.attr('class', function(d) { return 'block group'+groupIndex; })
				.attr('x', function(d, i) { return i*minPxPerSec/blocksPerSec; })
				.attr('y', 0)
				.attr('width', minPxPerSec/blocksPerSec)
				.attr('height', blocksHeight)
				.on('mousedown', function(d, i) {
					// if (logs) console.log('seekTo '+d.time/numSeconds+'s');
					wavesurfer.seekTo(d.time/numSeconds);
				});
			// brushes[groupIndex] = d3.svg.brush()
			// 	.x(blocksIndexToPx)
			// 	.on('brushstart', function() {
			// 		if (activeGroup !== groupIndex) {
			// 			SwitchGroup(groupIndex);
			// 			// SwitchBrush(activeGroup);
			// 			return;
			// 		}
			// 		var brush = brushes[activeGroup];
			// 		// if (logs) console.log(activeGroup+'\tbrushstart', isResizing, (brush.empty()?'empty':'full '), oldExtent, brush.extent());
			// 	})
			// 	.on('brush', function() {
			// 		var brush = brushes[activeGroup];
			// 		// if (logs) console.log(activeGroup+'\tbrush1    ', isResizing, (brush.empty()?'empty':'full '), oldExtent, brush.extent());
			// 		SnapBrush(groupIndex, Math.round(brush.extent()[0]), Math.round(brush.extent()[1]));
			// 		// if (logs) console.log(activeGroup+'\tbrush2    ', isResizing, (brush.empty()?'empty':'full '), oldExtent, brush.extent());

			// 		if (!isResizing) {
			// 			if (!blocksData[groupIndex][brush.extent()[0]].classified) { 
			// 				SnapBrush(groupIndex, 0, 0);
			// 				oldExtent = null;
			// 			} else {
			// 				ExpandBrush(groupIndex, brush.extent()[0]);
			// 				if (logs) console.log('ChangeBlocks', groupIndex);
			// 				ChangeBlocks(activeGroup, brush.extent()[0], brush.extent()[1], false);
			// 				isResizing = true;
			// 				oldExtent = [brush.extent()[0], brush.extent()[1]];
			// 				// brush.event(d3.select(brushNodes[0]));
			// 			}
			// 		} else {
			// 			if (d3.event.sourceEvent.type === 'mouseup') {
			// 				SnapBrush(groupIndex, oldExtent[0], oldExtent[1]);
			// 			} else if (brush.empty() && oldExtent !== null && oldExtent[0] !== oldExtent[1]) {
			// 				if (logs) console.log('ChangeBlocks', groupIndex);
			// 				ChangeBlocks(activeGroup, oldExtent[0], oldExtent[1], IsClassed(symbols[0]));
			// 				isResizing = false;
			// 				oldExtent = null;
			// 			} else {
			// 				oldExtent = [brush.extent()[0], brush.extent()[1]];
			// 			}
			// 		}
			// 		// if (logs) console.log(activeGroup+'\tbrush3    ', isResizing, (brush.empty()?'empty':'full '), oldExtent, brush.extent());
			// 	})
			// 	.on('brushend', function() {
			// 		var brush = brushes[activeGroup];
			// 		// if (logs) console.log(activeGroup+'\tbrushend  ', isResizing, (brush.empty()?'empty':'full '), oldExtent, brush.extent());

			// 		// var currentExtent = brushes[activeGroup].extent();
			// 		// ChangeBlocks(activeGroup, currentExtent[0], currentExtent[1], IsClassed(symbols[0]));

			// 		// if (logs) console.log('brushend  ', oldExtents[groupIndex], brush.extent());
			// 		// isBrushing = false;
			// 		// oldExtents[groupIndex] = [brush.extent()[0], brush.extent()[1]];
			// 		// if (brush.extent()[0] !== oldExtents[groupIndex][0] && brush.extent()[1] !== oldExtents[groupIndex][1]) {
			// 		// 	willChangeBlocks = true;
			// 		// }
			// 		// var brushExtentDiff = brush.extent()[1]-brush.extent()[0];
			// 		// if (brushExtentDiff > 1) {
			// 		// 	oldExtents[groupIndex] = [brush.extent()[0], brush.extent()[1]];	
			// 		// }
			// 		// if (logs) console.log('brushend', brushes[groupIndex].extent(), oldExtents[groupIndex], brushExtentDiff);
			// 	});
			// brushNodes[groupIndex] = d3.select(this).append('g')
			// 	.attr('class', 'brush brushdisabled group'+groupIndex)
			// 	.call(brushes[groupIndex]);
			// brushNodes[groupIndex].selectAll('rect')
			// 	.attr('y', 0.5*brushMargin)
			// 	.attr('height', blocksHeight-2*0.5*brushMargin)
			// 	.style('stroke-width', brushMargin);
		});

	secondsSvg = svgsContainer.append('svg')
		.attr('class', 'seconds-svg inlineblock')
		.attr('width', waveformWidth+2*10)
		.attr('height', secondsHeight)
		.append('g')
			.attr('class', 'text-origin')
			.attr('transform', 'translate('+svgsMargin+',0)');
	var secondLabels = secondsSvg.selectAll('text.label').data(d3.range(numSeconds+1));
	secondLabels.enter().append('text')
		.classed('label', true)
		.attr('x', function(d) { return d*minPxPerSec; })
		.attr('y', 0.5*secondsHeight)
		.text(function(d) { return d; });

	wavesurfer.on('audioprocess', function(time) {
		// Fires continuously as the audio plays. Also fires on seeking.
		if (time < oldTime) return; // bug in audioprocess that sets time to 0.xxx secondsFloat
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
		UpdatePlayerLine();
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
				.text(wavesurfer.backend.isPaused() ? 'Play' : 'Pause');
		});

	stopButton
		.on('mousedown', function() {
			if (wavesurfer.backend.isPaused() === false) {
				playPauseButton.on('mousedown')();
			}
			oldTime = 0;
			secondsFloat = 0;
			wavesurfer.seekTo(0);
			currentTimeLabel.text(secondsFloat.toFixed(1)+' s');
			body.select('wave').node().scrollLeft = 0;
		});

    speedSlider
        .on('change', function() {
        	// ClearBrushes();
            playbackSpeed = this.value;
            speedLabel.text('Playback Speed: x '+parseFloat(playbackSpeed).toFixed(1));
            wavesurfer.setPlaybackRate(playbackSpeed);
            // UpdateBlocks('speed-slider');
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

	body
		.on('keydown',  function() { HandleKeyEvent(d3.event); })
		// .on('keypress', function() { HandleKeyEvent(d3.event); })
		.on('keyup',    function() { HandleKeyEvent(d3.event); });
	// $(document)
	// 	.on('keydown', OnKeydown)
	// 	.on('keyup', OnKeyup);

	wavesurfer.seekTo(1);
	wavesurfer.seekTo(0);
	setTimeout(function() {
		SetLoadedClass('loaded');
		UpdateBlocks('load');
		blocksSvgs[0][0].focus();
		playerLine
			.style('height', appContainer.node().getBoundingClientRect().height+'px')
			.style('top', appContainer.node().getBoundingClientRect().top+'px');
	}, 100);

	function IsClassed(symbol) {
		switch (symbol.toUpperCase()) {
			case 'Z':
			// case 'X':
				return false;
			case 'X':
			// case 'C':
			// case 'V':
				return true;
			default:
				return null;
		};
	};

	function HandleKeyEvent(event) {
		// if (logs) console.log((event.type==='keydown'?'keydown':'keyup  '), event.key, symbols);

		if (event.code === 'Space') {
			event.preventDefault();
			if (event.type === 'keydown') {
				playPauseButton.node().dispatchEvent(new Event('mousedown'));
			}
			return;
		}
		if (event.key === 'Shift' && event.type === 'keydown') {
			var activeGroup = blocksSvgs[0].indexOf(document.activeElement);
			if (activeGroup === -1 || activeGroup === groupsArray.length-1) {
				blocksSvgs[0][0].focus();
			} else {
				blocksSvgs[0][activeGroup+1].focus();
			}
			return;
		}
		if (event.key.toUpperCase() === 'J' && event.type === 'keydown') {
			secondsFloat = Math.max(secondsFloat-1, 0);
			wavesurfer.seekTo(secondsFloat/numSeconds);
			return;
		}
		if (event.key.toUpperCase() === 'K' && event.type === 'keydown') {
			playPauseButton.node().dispatchEvent(new Event('mousedown'));
			return;
		}
		if (event.key.toUpperCase() === 'L' && event.type === 'keydown') {
			secondsFloat = Math.min(secondsFloat+1, wavesurfer.getDuration());
			wavesurfer.seekTo(secondsFloat/numSeconds);
			return;
		}

		var symbolIndex = symbols.indexOf(event.key);
		if (event.type === 'keydown') {
			if (symbolIndex === -1) {
				symbols.push(event.key);
			}
		}
		if (event.type === 'keyup') {
			if (symbolIndex !== -1) {
				symbols.splice(symbolIndex, 1);
			}
		}

		// if (logs) console.log(event.type, event.key, symbols);
		// UpdateBlocks(event.type+' '+event.key);
		
		// if (event.type === 'keydown');
		// switch (event.which) {
		// 	case 9: // Tab
		// 		// event.preventDefault();
		// 		var tabIndex = blocksSvgs[0].indexOf(document.activeElement);
		// 		break;
		// 	// case 16: // Shift
		// 	// 	// event.preventDefault();
		// 	// 	var tabIndex = blocksSvgs[0].indexOf(document.activeElement);
		// 	// 	break;
		// 	case 13: // Enter
		// 		event.preventDefault();
		// 		event.target.dispatchEvent(new Event('mousedown'));
		// 		break;
		// 	case 32: // Space
		// 		event.preventDefault();
		// 		playPauseButton.node().dispatchEvent(new Event('mousedown'));
		// 		break;
		// 	default:
		// 		symbols[0] = keyToSymbol[event.which];
		// 		UpdateBlocks('keydown '+event.which);
		// }
		// UpdateKeyPressedLabel(symbols[0]);
	};

	// function OnKeyup(event) {
	// 	// if (logs) console.log('keyup', symbols[0]);
	// 	// UpdateBlocks('keyup '+event.which);
	// 	symbols[0] = undefined;
	// 	// UpdateKeyPressedLabel(symbols[0]);
	// };

	// function OnKeydown(event) {
	// 	// if (logs) console.log('keydown '+symbols[0]);
	// 	switch (event.which) {
	// 		case 9: // Tab
	// 			// event.preventDefault();
	// 			var tabIndex = blocksSvgs[0].indexOf(document.activeElement);
	// 			break;
	// 		// case 16: // Shift
	// 		// 	// event.preventDefault();
	// 		// 	var tabIndex = blocksSvgs[0].indexOf(document.activeElement);
	// 		// 	break;
	// 		case 13: // Enter
	// 			event.preventDefault();
	// 			event.target.dispatchEvent(new Event('mousedown'));
	// 			break;
	// 		case 32: // Space
	// 			event.preventDefault();
	// 			playPauseButton.node().dispatchEvent(new Event('mousedown'));
	// 			break;
	// 		default:
	// 			symbols[0] = keyToSymbol[event.which];
	// 			UpdateBlocks('keydown '+event.which);
	// 	}
	// 	// UpdateKeyPressedLabel(symbols[0]);
	// };

	// function OnKeyup(event) {
	// 	// if (logs) console.log('keyup', symbols[0]);
	// 	// UpdateBlocks('keyup '+event.which);
	// 	symbols[0] = undefined;
	// 	// UpdateKeyPressedLabel(symbols[0]);
	// };

	// function SwitchGroup(switchingIndex) {
	// 	// if (logs) console.log('SwitchGroup', activeGroup, switchingIndex);
	// 	// var currentExtent = brushes[activeGroup].extent();
	// 	// ChangeBlocks(activeGroup, currentExtent[0], currentExtent[1], IsClassed(symbols[0]));
	// 	// ClearBrushes();
	// 	activeGroup = switchingIndex;
	// 	// blocksSvgs[0][activeGroup].focus();
	// 	// oldExtent = null;
	// 	// isResizing = false;
	// 	// UpdateBrushes(activeGroup, IsClassed(symbols[0]));
	// };

	// function ExpandBrush(groupIndex, blocksIndex) {
	// 	var minIndex = blocksIndex;
	// 	var maxIndex = blocksIndex;
	// 	while (minIndex >= 0 && blocksData[groupIndex][minIndex].classified) {
	// 		minIndex--;
	// 	}
	// 	minIndex++;
	// 	while (maxIndex < blocksData[groupIndex].length && blocksData[groupIndex][maxIndex].classified) {
	// 		maxIndex++;
	// 	}
	// 	// maxIndex--;
	// 	SnapBrush(groupIndex, minIndex, maxIndex);
	// };

	// function SnapBrush(groupIndex, minIndex, maxIndex) {
	// 	brushNodes[groupIndex]
	// 		.call(brushes[groupIndex].extent([minIndex, maxIndex]));
	// };

	// function SwitchBrush(groupIndex) {
	// 	svgsContainer.selectAll('rect.group-marker')
	// 		.classed('current', false)
	// 		.filter(function(d, i) { return i === activeGroup; })
	// 		.classed('current', true);
	// };

	// function UpdateBrushes(groupIndex, isClassed) {
	// 	brushNodes[groupIndex]
	// 		.classed('classified', isClassed);
	// };

	// function ClearBrushes() {
	// 	for (var groupIndex=0; groupIndex<(groupsArray.length); groupIndex++) {
	// 		// oldExtents[groupIndex] = null;
	// 		brushNodes[groupIndex].call(brushes[groupIndex].clear());
	// 	}
	// };

	// function ChangeBlocks(groupIndex, minIndex, maxIndex, isClassed) {
	// 	// if (logs) console.log('ChangeBlocks', groupIndex, minIndex, maxIndex, isClassed);
	// 	for (var blocksIndex=minIndex; blocksIndex<maxIndex; blocksIndex++) {
	// 		ChangeBlock(groupIndex, blocksIndex, isClassed);
	// 	}
	// };

	// function UpdateKeyPressedLabel(symbol) {
	// 	if (symbol === undefined) {
	// 		keyPressedLabel.text('Key Pressed: \u00A0');
	// 	} else {
	// 		keyPressedLabel.text('Key Pressed: '+symbol);
	// 	}
	// };

	function UpdatePlayerLine() {
		playerLine
			.style('left', (0+wavePlaying.node().getBoundingClientRect().right)+'px');
	};

	function UpdateBlocks(source) {
		if (body.classed('loaded') === false) return;
		currentTimeLabel.text(secondsFloat.toFixed(1)+'s');
		UpdatePlayerLine();
		if (symbols.length === 0) return;
		var activeGroup = blocksSvgs[0].indexOf(document.activeElement);
		if (activeGroup === -1) return;
		if (logs) console.log(secondsFloat.toFixed(1)+'s', source, activeGroup, symbols);
		
		// blocksSvgs[0][activeGroup].focus();
		// UpdateBrushes(activeGroup, IsClassed(symbols[0]));
		// if (brushes[activeGroup].empty()) {

		var blocksIndex = parseInt(secondsFloat*blocksPerSec);
		var isClassed = IsClassed(symbols[0]);
		if (isClassed === null || isClassed === blocksData[activeGroup][blocksIndex]['classified']) return;
	    blocksData[activeGroup][blocksIndex]['classified'] = isClassed;
	    d3.select(blocksRects[activeGroup][0][blocksIndex]).classed('classified', isClassed);

	    // if (debug) {
	    // 	var keyValueArray = [];
	    // 	var usedKeyHash = {};
	    // 	var valueString;
	    // 	var testRegExp = new RegExp('^get');
	    // 	var skippedKeysHash = {
	    // 		'wavesurfer.backend': ['gainNode', 'getAudioContext', 'getOfflineAudioContext', 'handlers'],
	    // 		'wavesurfer': ['backend', 'defaultParams', 'drawer', 'Drawer', 'getArrayBuffer', 'handlers', 'WebAudio']
	    // 	};
	    // 	var indentString;
	    // 	function addKeyValuePairs(myObject, keyText, indent) {
	    // 		var indentString = Array(indent).join('    ');
	    // 		var skippedKeys = (skippedKeysHash[keyText] !== undefined) ? skippedKeysHash[keyText] : [];
	    // 		// if (logs) console.log('Looping over key '+keyText+'" skipping:', skippedKeys);
	    // 		$.each(myObject, function(key, value) {
	    // 			// if (logs) console.log(indentString+'"'+key+'", '+typeof(value));
	    // 			if (skippedKeys.indexOf(key) !== -1) return;
	    // 			if (usedKeyHash[key] !== undefined) return;
	    // 			if (typeof(value) === 'function' && testRegExp.test(key) === true) {
	    // 				// if (logs) console.log(indentString, value, myObject);
	    // 				valueString = JSON.stringify(value.apply(myObject));
	    // 			} else {
	    // 				valueString = JSON.stringify(value);
	    // 			}
	    // 			if ([undefined, '{}'].indexOf(valueString) !== -1) return;
	    // 			if (typeof(value) === 'object' && value !== null) {
	    // 				// if (logs) console.log(indentString+'Stepping in to  "'+key+'" from "'+keyText+'" skipping:', skippedKeys);
	    // 				addKeyValuePairs(value, key, indent+1);
	    // 			} else {
	    // 				usedKeyHash[key] = valueString;
	    // 			}
	    // 		});
	    // 		// if (logs) console.log(indentString+'Done looping for "'+keyText+'"\n\n');
	    // 	};
	    // 	addKeyValuePairs(wavesurfer.backend, 'wavesurfer.backend', 0);
	    // 	addKeyValuePairs(wavesurfer, 'wavesurfer', 0);
	    // 	var metadata = {
	    // 		trackURL:trackURL,
	    // 		trackDurationSec:wavesurfer.getDuration(),
	    // 		blocksPerSec:blocksPerSec,
	    // 		startTime:startTime,
	    // 		exportTime:exportTime,
	    // 		elapsedSec:(exportTime-startTime)/1000,
	    // 		playbackSpeed:playbackSpeed,
	    // 		// zoomValue:zoomValue,
	    // 	};
	    // 	addKeyValuePairs(metadata, 'metadata', 0);

	    // 	$.each(usedKeyHash, function(key, value) {
	    // 		keyValueArray.push({ 'key':key, 'value':value });
	    // 	});

	    // 	var rows = debugContainer.selectAll('div.plain-text').data(keyValueArray);
	    // 	rows.exit().remove();
	    // 	rows.enter().append('div').attr('class', 'plain-text').each(function(d) {
    	// 		d3.select(this).append('span').attr('class', 'key-text');
    	// 		d3.select(this).append('span').attr('class', 'value-text');
    	// 	});
	    // 	rows.each(function(d) {
	    // 		var oldValue = d3.select(this).selectAll('span.value-text').attr('old-value');
	    // 		if (String(d.value) !== String(oldValue)) {
	    // 			d3.select(this).selectAll('span').interrupt()
	    // 				.style('color', 'red').transition().duration(1000).style('color', 'black');
	    // 		}
    	// 		d3.select(this).selectAll('span.key-text').text(d.key);
    	// 		d3.select(this).selectAll('span.value-text').text(d.value);
    	// 		d3.select(this).selectAll('span.value-text').attr('old-value', d.value);
    	// 	});
	    // };
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
			groupsArray: groupsArray,
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
		if (logs) console.log(exportedData.blocksDataRefined);
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