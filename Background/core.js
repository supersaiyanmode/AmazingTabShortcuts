var core = (function(){
	var pinnedTabStatus = {};
	
	return {
		moveTabLeft: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(tab){
				if (tab.index > 0) {
					chrome.tabs.move(tab.id,{index: tab.index-1},null);
				}
			});
		},
		moveTabRight: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(tab){
				chrome.tabs.move(tab.id,{index: tab.index+1},null);
			});
		},
		moveTabLeftMost: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(tab){
				if (tab.index > 0)
					chrome.tabs.move(tab.id,{index: 0},null);
			});
		},
		moveTabRightMost: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(tab){
				chrome.tabs.move(tab.id,{index: 1000},null); //max 1000
			});
		},
		duplicateTab: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(tab){
				chrome.tabs.duplicate(tab.id, null);
			});	
		},
		pinTab: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(tab){
				if (!tab.pinned) {
					pinnedTabStatus[tab.id] = {index: tab.index};
					chrome.tabs.update(tab.id, {pinned: true}, null);
				} else {
					var info = pinnedTabStatus[tab.id];
					chrome.tabs.update(tab.id, {pinned: false}, null);
					if (info) {
						chrome.tabs.move(tab.id,{index: info.index},null);
					}
				}
			});
		},
	};
})();

var commandCore = {
	listCommands: function(cmd, event, resp) {
		value = [
			{
				"name": "MoveTabLeft",
				"bind": "ctrl+shift+left"
			},
			{
				"name": "MoveTabRight",
				"bind": "ctrl+shift+right"
			},
			{
				"name": "MoveTabLeftMost",
				"bind": "ctrl+shift+alt+left"
			},
			{
				"name": "MoveTabRightMost",
				"bind": "ctrl+shift+alt+right"
			},
			{
				"name": "DuplicateTab",
				"bind": "ctrl+shift+command+d"
			},
			{
				"name": "PinTab",
				"bind": "ctrl+shift+command+p"
			}
		];
		resp("value", value);
	}
}


var module = (function(){
	var c = core;
	var cc = commandCore;
	var pd = function(cmd, event, resp) { resp("event", false); };
	var handlers = {
		"Tab": {
			"MoveTabLeft": [c.moveTabLeft, pd],
			"MoveTabRight": [c.moveTabRight, pd],
			"MoveTabLeftMost": [c.moveTabLeftMost, pd],
			"MoveTabRightMost": [c.moveTabRightMost, pd],
			"DuplicateTab": [c.duplicateTab, pd],
			"PinTab": [c.pinTab, pd]
		},
		"Control": {
			"Commands": [cc.listCommands]
		}
	};
		
	return {
		init: function() {
			chrome.extension.onConnect.addListener(function(port) {
				if (!(port.name in handlers)) {
					return;
				}
				port.onMessage.addListener((function(handler) {
					return function(obj) {
						var event = obj.event, command = obj.command, id = obj.id;
				
						var response = {id: obj.id, response: {}};
						handler[command.name].forEach(function(fn){
							fn(command, event, function(key, val) {
								response.response[key] = val;
							});
						});
						port.postMessage(response);
					}
				})(handlers[port.name]));
			});
		},
	};
}());

module.init();