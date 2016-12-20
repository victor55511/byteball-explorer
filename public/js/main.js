var _cy;
var nodes, edges;
var firstUnit, lastUnit, phantoms = {}, notStable = [];
var nextPositionUpdates;
var generateOffset = 0, newOffset = -120, oldOffset;
var activeNode, waitGo;
var notLastUnitUp = false, notLastUnitDown = true;
var lastActiveUnit;
var page;

function init(_nodes, _edges) {
	nodes = _nodes;
	edges = _edges;
	firstUnit = nodes[0].rowid;
	lastUnit = nodes[nodes.length - 1].rowid;
	phantoms = {};
	notStable = [];
	nextPositionUpdates = null;
	generateOffset = 0;
	newOffset = -120;
	oldOffset = null;
	createCy();
	generate(nodes, edges);
	_cy.viewport({zoom: 1.01});
	_cy.center(_cy.nodes()[0]);
	page = 'dag';

	if (location.hash && location.hash.length == 45) {
		notLastUnitUp = true;
		highlightNode(location.hash.substr(1));
	}
}

function start() {
	if (!location.hash || (location.hash.length != 45 && location.hash.length != 33)) {
		socket.emit('start', {type: 'last'});
	}
	else if (location.hash.length == 45) {
		socket.emit('start', {type: 'unit', unit: location.hash.substr(1)});
		notLastUnitUp = true;
	}
	else if (location.hash.length == 33) {
		socket.emit('start', {type: 'address', address: location.hash.substr(1)});
		$('#addressInfo').show();
	}
}

function createCy() {
	_cy = cytoscape({
		container: document.getElementById('cy'),
		boxSelectionEnabled: false,
		autounselectify: true,
		hideEdgesOnViewport: false,
		layout: {
			name: 'preset'
		},
		style: [
			{
				selector: 'node',
				style: {
					'content': 'data(unit_s)',
					'text-opacity': 1,
					'min-zoomed-font-size': 13,
					'text-valign': 'bottom',
					'text-halign': 'center',
					'font-size': '13px',
					'text-margin-y': '5px',
					'background-color': '#fff',
					'border-width': 3,
					'border-color': '#2c3e50',
					'width': 25,
					'height': 25
				}
			},
			{
				selector: 'node.hover',
				style: {
					'content': 'data(id)',
					'text-opacity': 1,
					'font-weight': 'bold',
					'font-size': '14px',
					'text-background-color': '#fff',
					'text-background-opacity': 1,
					'text-background-shape': 'rectangle',
					'text-border-opacity': 1,
					'text-border-width': 4,
					'text-border-color': '#fff',
					'z-index': 9999
				}
			},
			{
				selector: 'edge',
				style: {
					'width': 3,
					'target-arrow-shape': 'triangle',
					'line-color': '#99abd5',
					'target-arrow-color': '#99abd5',
					'curve-style': 'bezier'
				}
			},
			{
				selector: '.best_parent_unit',
				style: {
					'width': 4.5,
					'target-arrow-shape': 'triangle',
					'line-color': '#99abd5',
					'target-arrow-color': '#99abd5',
					'curve-style': 'bezier'
				}
			},
			{
				selector: '.is_on_main_chain',
				style: {
					'border-color': '#0ec3a0'
				}
			},
			{
				selector: '.is_stable',
				style: {
					'background-color': '#99abd5'
				}
			},
			{
				selector: '.active',
				style: {
					'background-color': '#2980b9',
					'border-width': '0'
				}
			}
		],
		elements: {
			nodes: [],
			edges: []
		}
	});

	_cy.on('mouseover', 'node', function() {
		this.addClass('hover');
	});

	_cy.on('mouseout', 'node', function() {
		this.removeClass('hover');
	});

	_cy.on('click', 'node', function(evt) {
		location.hash = '#' + evt.cyTarget.id();
	});

	_cy.on('tap', 'node', function(evt) {
		location.hash = '#' + evt.cyTarget.id();
	});

	_cy.on('pan', function() {
		var ext = _cy.extent();
		if (nextPositionUpdates < ext.y2) {
			getNext();
		}
		else if (notLastUnitUp === true && ext.y2 - (ext.h) < _cy.getElementById(nodes[0].data.unit).position().y) {
			getPrev();
		}
	});

	$(_cy.container()).on('wheel mousewheel', function(e) {
		var deltaY = e.originalEvent.wheelDeltaY || -e.originalEvent.deltaY;
		if (page == 'dag') {
			e.preventDefault();
			if (deltaY > 0) {
				scrollUp();
			}
			else if (deltaY < 0) {
				_cy.panBy({x: 0, y: -25});
			}
		}
	});
}

function generate(_nodes, _edges) {
	var newOffset_x, newOffset_y, left = Infinity, right = -Infinity, first = false, generateAdd = [], _node, classes = '', pos_iomc;
	var graph = createGraph(_nodes, _edges);
	graph.nodes().forEach(function(unit) {
		_node = graph.node(unit);
		if (_node) {
			if (_node.x < left) left = _node.x;
			if (_node.x > right) right = _node.x;
		}
	});
	graph.nodes().forEach(function(unit) {
		_node = graph.node(unit);
		if (_node) {
			classes = '';
			if (_node.is_on_main_chain) classes += 'is_on_main_chain ';
			if (_node.is_stable) {
				classes += 'is_stable ';
			}
			else {
				if (notStable.indexOf(unit) == -1) notStable.push(unit);
			}
			if (!first) {
				newOffset_x = -_node.x - ((right - left) / 2);
				newOffset_y = generateOffset - _node.y + 120;
				first = true;
			}
			if (phantoms[unit]) {
				_cy.remove(_cy.getElementById(unit));
				generateAdd.push({
					group: "nodes",
					data: {id: unit, unit_s: _node.label},
					position: {x: phantoms[unit], y: _node.y + newOffset_y},
					classes: classes
				});
				delete phantoms[unit];
			}
			else {
				pos_iomc = setMaxWidthNodes(_node.x + newOffset_x);
				if (pos_iomc == 0 && _node.is_on_main_chain == 0) {
					pos_iomc += 40;
				}
				generateAdd.push({
					group: "nodes",
					data: {id: unit, unit_s: _node.label},
					position: {x: pos_iomc, y: _node.y + newOffset_y},
					classes: classes
				});
			}
		}
	});
	generateAdd = fixConflicts(generateAdd);
	_cy.add(generateAdd);
	generateOffset = _cy.nodes()[_cy.nodes().length - 1].position().y;
	nextPositionUpdates = generateOffset;
	_cy.add(createEdges());
}

function setNew(_nodes, _edges) {
	var newOffset_x, newOffset_y, min = Infinity, max = -Infinity, left = Infinity, right = -Infinity, first = false, x, y, generateAdd = [], _node, classes = '', pos_iomc;
	var graph = createGraph(_nodes, _edges);
	graph.nodes().forEach(function(unit) {
		_node = graph.node(unit);
		if (_node) {
			y = _node.y;
			if (y < min) min = y;
			if (y > max) max = y;
			if (_node.x < left) left = _node.x;
			if (_node.x > right) right = _node.x;
		}
	});
	graph.nodes().forEach(function(unit) {
		_node = graph.node(unit);
		if (_node) {
			classes = '';
			if (_node.is_on_main_chain) classes += 'is_on_main_chain ';
			if (_node.is_stable) {
				classes += 'is_stable ';
			}
			else {
				if (notStable.indexOf(unit) == -1) notStable.push(unit);
			}
			if (!first) {
				newOffset_x = -_node.x - ((right - left) / 2);
				newOffset_y = newOffset - (max - min) + _node.y + 120;
				oldOffset = newOffset_y + 120;
				newOffset -= (max - min) + _node.y + 120;
				first = true;
				if (_cy.extent().y1 < oldOffset) {
					_cy.stop();
					_cy.animate({
						pan: {
							x: _cy.pan('x'),
							y: _cy.pan('y') + ((max - min) + _node.y) + 86
						}
					}, {
						duration: 300
					});
				}
			}
			x = _node.x + newOffset_x;
			y = _node.y + newOffset_y;
			pos_iomc = setMaxWidthNodes(x);
			if (pos_iomc == 0 && _node.is_on_main_chain == 0) {
				pos_iomc += 40;
			}
			generateAdd.push({
				group: "nodes",
				data: {id: unit, unit_s: _node.label},
				position: {x: pos_iomc, y: y},
				classes: classes
			});
		}
	});
	generateAdd = fixConflicts(generateAdd);
	_cy.add(generateAdd);
	_cy.add(createEdges());
}

function createGraph(_nodes, _edges) {
	var graph = new dagre.graphlib.Graph({
		multigraph: true,
		compound: true
	});
	graph.setGraph({});
	graph.setDefaultEdgeLabel(function() {
		return {};
	});
	_nodes.forEach(function(node) {
		graph.setNode(node.data.unit, {
			label: node.data.unit_s,
			width: 32,
			height: 32,
			is_on_main_chain: node.is_on_main_chain,
			is_stable: node.is_stable
		});
	});
	for (var k in _edges) {
		if (_edges.hasOwnProperty(k)) {
			graph.setEdge(_edges[k].data.source, _edges[k].data.target);
		}
	}
	dagre.layout(graph);
	return graph;
}

function setMaxWidthNodes(x) {
	if (x > 500) {
		return x / (x / 500);
	}
	else if (x < -500) {
		return -((x / (x / 500)));
	}
	else {
		return x;
	}
}

function fixConflicts(arr) {
	var conflicts = {}, a, b, l, l2;
	for (a = 0, l = arr.length; a < l; a++) {
		for (b = 0; b < l; b++) {
			if (a != b && ((arr[a].position.x < arr[b].position.x + 10 && arr[a].position.x > arr[b].position.x - 10) && arr[a].position.y == arr[b].position.y)) {
				if (!conflicts[arr[a].position.y]) conflicts[arr[a].position.y] = [];
				conflicts[arr[a].position.y].push(arr[a]);
			}
		}
	}
	for (var k in conflicts) {
		var offset = 0, units = [];
		for (b = 0, l2 = conflicts[k].length; b < l2; b++) {
			for (a = 0; a < l; a++) {
				if (arr[a].data.id == conflicts[k][b].data.id && units.indexOf(arr[a].data.id) == -1) {
					units.push(arr[a].data.id);
					if (arr[a].position.x < 0) {
						offset -= 60;
					}
					else {
						offset += 60;
					}
					arr[a].position.x += offset;
				}
			}
		}
	}
	return arr;
}

function createEdges() {
	var _edges = cloneObj(edges), cyEdges = _cy.edges(), cyEdgesLength = cyEdges.length, k, out = [], position, offset = 0, classes = '';
	for (var a = 0, l = cyEdgesLength; a < l; a++) {
		k = cyEdges[a].source() + '_' + cyEdges[a].target();
		if (_edges[k]) delete _edges[k];
	}
	for (k in _edges) {
		if (_edges.hasOwnProperty(k)) {
			classes = '';
			classes += _edges[k].best_parent_unit ? 'best_parent_unit' : '';
			if (_cy.getElementById(_edges[k].data.target).length) {
				out.push({group: "edges", data: _edges[k].data, classes: classes});
			}
			else {
				position = _cy.getElementById(_edges[k].data.source).position();
				phantoms[_edges[k].data.target] = position.x + offset;
				out.push({
					group: "nodes",
					data: {id: _edges[k].data.target, unit_s: _edges[k].data.target.substr(0, 7) + '...'},
					position: {x: position.x + offset, y: generateOffset + 120}
				});
				offset += 60;
				out.push({group: "edges", data: _edges[k].data, classes: classes});
			}
		}
	}
	return out;
}

function setChangesStableUnits(arrStableUnits) {
	if (!arrStableUnits) return;
	var node;
	arrStableUnits.forEach(function(objUnit) {
		node = _cy.getElementById(objUnit.unit);
		if (node) {
			if (!node.hasClass('is_stable')) node.addClass('is_stable');
			if (objUnit.is_on_main_chain === 1 && !node.hasClass('is_on_main_chain')) {
				node.addClass('is_on_main_chain');
			}
			else if (objUnit.is_on_main_chain === 0 && node.hasClass('is_on_main_chain')) {
				node.removeClass('is_on_main_chain');
			}
		}
		notStable.splice(notStable.indexOf(objUnit.unit), 1);
	});
}

function cloneObj(obj) {
	var out = {};
	for (var k in obj) {
		if (obj.hasOwnProperty(k)) {
			out[k] = obj[k];
		}
	}
	return out;
}

function highlightNode(unit) {
	if (!_cy) createCy();
	if (activeNode) _cy.getElementById(activeNode).removeClass('active');
	var el = _cy.getElementById(unit);
	if (el.length) {
		bWaitingForPrev = true;
		lastActiveUnit = location.hash.substr(1);
		el.addClass('active');
		activeNode = el.id();
		socket.emit('info', {unit: activeNode});
		_cy.stop();
		_cy.animate({
			pan: {x: _cy.pan('x'), y: _cy.getCenterPan(el).y},
			complete: function() {
				bWaitingForPrev = false;
			}
		}, {
			duration: 250
		});
		page = 'dag';
	}
	else {
		waitGo = unit;
		getHighlightNode(waitGo);
	}
	return false;
}

function scrollUp() {
	var ext = _cy.extent();
	if ((notLastUnitUp === false && ext.y2 - (ext.h / 2) > _cy.getElementById(nodes[0].data.unit).position().y + 20) ||
		(notLastUnitUp === true && ext.y2 - (ext.h) > _cy.getElementById(nodes[0].data.unit).position().y)
	) {
		_cy.panBy({x: 0, y: 25});
	}
	else if (notLastUnitUp === true) {
		getPrev();
	}
}

function showHideBlock(id) {
	var block = $('#' + id);
	var target;
	if (event.target.classList.contains('infoTitle')) {
		target = $(event.target);
	}
	else {
		target = $(event.target.parentNode);
	}
	if (block.css('display') === 'none') {
		block.show(250);
		target.removeClass('hideTitle');
	}
	else {
		block.hide(250);
		target.addClass('hideTitle');
	}
}

function searchForm(text) {
	if (text.length == 44 || text.length == 32) {
		location.hash = text;
	}
	else {
		showInfoMessage("Please enter a unit or address");
	}
	$('#inputSearch').val('');
}

//events
window.addEventListener('hashchange', function() {
	if (location.hash.length == 45) {
		highlightNode(location.hash.substr(1));
		if ($('#addressInfo').css('display') == 'block') {
			$('#addressInfo').hide();
		}
	}
	else if (location.hash.length == 33) {
		socket.emit('start', {type: 'address', address: location.hash.substr(1)});
	}
});

window.addEventListener('keydown', function(e) {
	if (page == 'dag') {
		if (e.keyCode == 38) {
			e.preventDefault();
			scrollUp();
		}
		else if (e.keyCode == 40) {
			e.preventDefault();
			_cy.panBy({x: 0, y: -25});
		}
	}
}, true);

$(window).scroll(function() {
	if (($(window).scrollTop() + $(window).height()) + 200 >= $(document).height()) {
		if (!nextPageTransactionsEnd) {
			getNextPageTransactions();
		}
	}
});

//websocket
var socket = io.connect(location.href);
var bWaitingForNext = false, bWaitingForNew = false, bHaveDelayedNewRequests = false, bWaitingForPrev = false, bWaitingForHighlightNode = false, bWaitingForNextPageTransactions = false;
var nextPageTransactionsEnd = false, pageTransactions = 0;

socket.on('connect', function() {
	start();
});

socket.on('start', function(data) {
	init(data.nodes, data.edges);
	if (data.not_found) showInfoMessage("Unit not found");
	notLastUnitDown = true;
	if (bWaitingForHighlightNode) bWaitingForHighlightNode = false;
});

socket.on('next', function(data) {
	if (notLastUnitDown) {
		if (bWaitingForHighlightNode) bWaitingForHighlightNode = false;
		nodes = nodes.concat(data.nodes);
		for (var k in data.edges) {
			if (data.edges.hasOwnProperty(k)) {
				edges[k] = data.edges[k];
			}
		}
		lastUnit = nodes[nodes.length - 1].rowid;
		generate(data.nodes, edges);
		bWaitingForNext = false;
		if (waitGo) {
			highlightNode(waitGo);
			waitGo = false;
		}
		if (data.nodes.length === 0) {
			notLastUnitDown = false;
		}
		setChangesStableUnits(data.arrStableUnits);
	}
});

socket.on('prev', function(data) {
	if (bWaitingForHighlightNode) bWaitingForHighlightNode = false;
	nodes = [].concat(data.nodes, nodes);
	for (var k in data.edges) {
		if (data.edges.hasOwnProperty(k)) {
			edges[k] = data.edges[k];
		}
	}
	firstUnit = nodes[0].rowid;
	setNew(data.nodes, edges);
	bWaitingForPrev = false;
	if (data.end === true) {
		notLastUnitUp = false;
	}
	if (waitGo) {
		highlightNode(waitGo);
		waitGo = false;
	}
	setChangesStableUnits(data.arrStableUnits);
});

function generateMessageInfo(messages, transfersInfo, outputsUnit) {
	var messagesOut = '', blockId = 0, key, asset;
	messages.forEach(function(message) {
		if ((message.app == 'payment' || message.app == 'text' || message.app == 'asset') && (message.payload)) {
			asset = message.payload.asset || 'null';
			messagesOut +=
				'<div class="message">' +
				'<div class="message_app infoTitleChild" onclick="showHideBlock(\'message_' + blockId + '\')">';
			if (message.app == 'payment') {
				messagesOut += message.app.substr(0, 1).toUpperCase() + message.app.substr(1) + ' in ' + (asset ? asset : 'bytes');
			}
			else if (message.app == 'asset') {
				messagesOut += 'Definition of new asset';
			}
			else {
				messagesOut += message.app.substr(0, 1).toUpperCase() + message.app.substr(1);
			}
			messagesOut += '</div>' +
				'<div class="messagesInfo" id="message_' + (blockId++) + '">';

			switch (message.app) {
				case 'payment':
					if (message.payload) {
						messagesOut += '<div class="message_inputs"><div class="infoTitleInputs" onclick="showHideBlock(\'message_' + blockId + '\')">Inputs</div>' +
							'<div class="inputsInfo" id="message_' + (blockId++) + '">';

						message.payload.inputs.forEach(function(input) {
							if (input.type && input.type == 'issue') {
								messagesOut +=
									'<div class="infoTitleInput" onclick="showHideBlock(\'message_' + blockId + '\')">Issue</div>' +
									'<div class="inputInfo" id="message_' + (blockId++) + '">' +
									'<div>Serial number: ' + input.serial_number + '</div>' +
									'<div>Amount: ' + input.amount + '</div>' +
									'</div>';
							}
							else {
								key = input.unit + '_' + input.output_index + '_' + (asset);
								messagesOut += '<div>' + transfersInfo[key].amount + ' from ' +
									'<a href="#' + transfersInfo[key].unit + '">' + transfersInfo[key].unit + '</a></div>';
							}
						});

						messagesOut += '</div></div>' +
							'<div class="message_outputs"><div class="infoTitleInputs" onclick="showHideBlock(\'message_' + blockId + '\')">Outputs</div>' +
							'<div class="inputsInf" id="message_' + (blockId++) + '">';

						outputsUnit[asset].forEach(function(output) {
							messagesOut += '<div class="outputs_div">';
							if (output.is_spent) {
								messagesOut += '<div>' + output.amount + ' to <a href="#' + output.address + '">' + output.address + '</a><br> ' +
									'(spent in <a href="#' + output.spent + '">' + output.spent + '</a>)</div>';
							}
							else {
								messagesOut += '<div>' + output.amount + ' to <a href="#' + output.address + '">' + output.address + '</a><br> (not spent)</div>';
							}
							messagesOut += '</div>';
						});

						messagesOut += '</div></div>';
					}
					break;
				case 'text':
					messagesOut += '<div>Text: ' + message.payload + '</div>';
					break;
				case 'asset':
					for (var key_payload in message.payload) {
						if (key_payload != 'denominations') {
							messagesOut += '<div class="asset">' + key_payload + ': ' + message.payload[key_payload] + '</div>';
						}
					}
					break;
			}
			messagesOut += '</div></div>';
		}
	});
	return messagesOut;
}

socket.on('info', function(data) {
	if (bWaitingForHighlightNode) bWaitingForHighlightNode = false;
	if (data) {
		var childOut = '', parentOut = '', authorsOut = '', witnessesOut = '';
		data.child.forEach(function(unit) {
			childOut += '<div><a href="#' + unit + '">' + unit + '</a></div>';
		});
		data.parents.forEach(function(unit) {
			parentOut += '<div><a href="#' + unit + '">' + unit + '</a></div>';
		});
		data.authors.forEach(function(author) {
			authorsOut += '<div><a href="#' + author.address + '">' + author.address + '</a></div>';
		});
		data.witnesses.forEach(function(witness) {
			witnessesOut += '<div><a href="#' + witness + '">' + witness + '</a></div>';
		});

		$('#unit').html(data.unit);
		$('#children').html(childOut);
		$('#parents').html(parentOut);
		$('#authors').html(authorsOut);
		$('#fees').html((parseInt(data.headers_commission) + parseInt(data.payload_commission)) + ' (' + data.headers_commission + ' headers, ' + data.payload_commission + ' payload)');
		$('#level').html(data.level);
		$('#main_chain_index').html(data.main_chain_index);
		$('#latest_included_mc_index').html(data.latest_included_mc_index);
		$('#is_stable').html(data.is_stable);
		$('#witnesses').html(witnessesOut);
		$('#messages').html(generateMessageInfo(data.messages, data.transfersInfo, data.outputsUnit));
		if ($('#listInfo').css('display') == 'none') {
			$('#defaultInfo').hide();
			$('#listInfo').show();
		}
		adaptiveShowInfo();
	}
	else {
		showInfoMessage("Unit not found");
	}
});

socket.on('update', getNew);

socket.on('new', function(data) {
	if (data.nodes.length) {
		nodes = [].concat(data.nodes, nodes);
		for (var k in data.edges) {
			if (data.edges.hasOwnProperty(k)) {
				edges[k] = data.edges[k];
			}
		}
		firstUnit = nodes[0].rowid;
		setNew(data.nodes, edges);
		bWaitingForNew = false;
		if (bHaveDelayedNewRequests) {
			bHaveDelayedNewRequests = false;
			getNew();
		}
	}
	else {
		bWaitingForNew = false;
	}
	setChangesStableUnits(data.arrStableUnits);
});

function generateTransactionsList(objTransactions, address) {
	var transaction, addressOut, _addressTo, listTransactions = '';
	for (var k in objTransactions) {
		transaction = objTransactions[k];

		listTransactions += '<tr>' +
			'<th colspan="3" align="left">' +
			'<div class="transactionUnit"><a href="#' + transaction.unit + '">' + transaction.unit + '</a></div>' +
			'</th>' +
			'<tr><td>';

		transaction.from.forEach(function(objFrom) {
			addressOut = objFrom.address == address ? '<span class="thisAddress">' + objFrom.address + '</span>' : '<a href="#' + objFrom.address + '">' + objFrom.address + '</a>';
			if (objFrom.issue) {
				listTransactions += '<div class="transactionUnitListAddress">' +
					'<div>' + addressOut + '</div>' +
					'<div>Issue ' + objFrom.amount + ' ' + transaction.asset + '</div>' +
					'<div>serial number: ' + objFrom.serial_number + '</div></div>';
			}
			else {
				listTransactions += '<div class="transactionUnitListAddress"><div>' + addressOut + '</div>' +
					'<div>(' + objFrom.amount + ' ' + (transaction.asset == null ? 'bytes' : transaction.asset) + ')</div></div>';
			}
		});
		listTransactions += '</td><td><img width="32" src="' + (transaction.spent ? '/img/red_right2.png' : '/img/green_right2.png') + '"></td><td>';
		for (var k in transaction.to) {
			_addressTo = transaction.to[k];
			addressOut = _addressTo.address == address ? '<span class="thisAddress">' + _addressTo.address + '</span>' : '<a href="#' + _addressTo.address + '">' + _addressTo.address + '</a>';

			listTransactions += '<div class="transactionUnitListAddress"><div>' + addressOut + '</div>' +
				'<div>(' + _addressTo.amount + ' ' + (transaction.asset == null ? 'bytes' : transaction.asset) + ', ' +
				(_addressTo.spent === 0 ? 'not spent' : 'spent in ' + '<a href="#' + _addressTo.spent + '">' + _addressTo.spent + '</a>') +
				')</div></div>';
		}
		listTransactions += '</td></tr>';
	}
	return listTransactions;
}

socket.on('addressInfo', function(data) {
	if (data) {
		var listUnspent = '', balance = '';
		pageTransactions = 1;
		nextPageTransactionsEnd = data.end;
		for (var k in data.objBalance) {
			if (k === 'bytes') {
				balance += '<div>' + data.objBalance[k] + ' bytes</div>';
			}
			else {
				balance += '<div>' + data.objBalance[k] + ' of ' + k + '</div>';
			}
		}
		data.unspent.forEach(function(row) {
			listUnspent += '<div><a href="#' + row.unit + '">' + row.unit + '</a> (' + row.amount + ' ' + (row.asset == null ? 'bytes' : row.asset) + ')</div>';
		});
		$('#address').html(data.address);
		$('#balance').html(balance);
		$('#listUnspent').html(listUnspent);
		$('#listUnits').html(generateTransactionsList(data.objTransactions, data.address));
		if (listUnspent != '') {
			$('#blockListUnspent').show();
		}
		else {
			$('#blockListUnspent').hide();
		}
		if ($('#addressInfo').css('display') == 'none') {
			$('#addressInfo').show();
		}
		page = 'address';
	}
	else {
		showInfoMessage("Address not found");
	}
	bWaitingForNextPageTransactions = false;
});

socket.on('nextPageTransactions', function(data) {
	if (data) {
		pageTransactions++;
		nextPageTransactionsEnd = data.end;
		$('#listUnits').append(generateTransactionsList(data.objTransactions, data.address));
	}
	bWaitingForNextPageTransactions = false;
});

function getNew() {
	if (notLastUnitUp) return;

	if (!bWaitingForNew) {
		socket.emit('new', {unit: firstUnit, notStable: notStable});
		bWaitingForNew = true;
	}
	else {
		bHaveDelayedNewRequests = true;
	}
}

function getNext() {
	if (!bWaitingForNext) {
		socket.emit('next', {last: lastUnit, notStable: notStable});
		bWaitingForNext = true;
	}
}

function getPrev() {
	if (!bWaitingForPrev) {
		socket.emit('prev', {first: firstUnit, notStable: notStable});
		bWaitingForPrev = true;
	}
}

function getHighlightNode(unit) {
	if (!bWaitingForHighlightNode) {
		socket.emit('highlightNode', {first: firstUnit, last: lastUnit, unit: unit});
		bWaitingForHighlightNode = true;
	}
}

function getNextPageTransactions() {
	if (!bWaitingForNextPageTransactions && location.hash.length == 33) {
		socket.emit('nextPageTransactions', {address: location.hash.substr(1), page: pageTransactions});
		bWaitingForNextPageTransactions = true;
	}
}

//adaptive
function adaptiveShowInfo() {
	$('#cy').addClass('showInfoBlock');
	$('#info').removeClass('hideInfoBlock');
}

function closeInfo() {
	$('#info').addClass('hideInfoBlock');
	$('#cy').removeClass('showInfoBlock');
}

function closeAddress() {
	$('#addressInfo').hide();
	$('#blockListUnspent').hide();
	if (!_cy || !lastActiveUnit) {
		$('#cy').show();
		socket.emit('start', {type: 'last'});
		location.hash = '';
	}
	else {
		location.hash = lastActiveUnit;
	}
	page = 'dag';
}


//infoMessage
var timerInfoMessage;

function showInfoMessage(text, timeMs) {
	if (!timeMs) timeMs = 3000;
	if (timerInfoMessage) clearTimeout(timerInfoMessage);

	$('#infoMessage').html(text).show(350);
	timerInfoMessage = setTimeout(function() {
		$('#infoMessage').hide(350).html('');
	}, timeMs);
}

function hideInfoMessage() {
	if (timerInfoMessage) clearTimeout(timerInfoMessage);
	$('#infoMessage').hide(350).html('');
}
