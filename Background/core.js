var core = (function(){
	var pinnedTabStatus = {};
	var tabMovementStatus = {};
	
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
		moveTabOut: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(curTab) {
				chrome.windows.create({tabId:curTab.id}, function(window){
					if (!tabMovementStatus[curTab.id]) {
						tabMovementStatus[curTab.id] = [];
					}
					tabMovementStatus[curTab.id].push({
						fromWindowId: curTab.windowId,
						toWindowId: window.id,
						fromWindowIndex: curTab.index,
						tabId: curTab.id
					});
					chrome.tabs.update(curTab.id,{selected:true},null);
				});
			});
		},
		moveTabIn: function(command, event, resp) {
			chrome.tabs.getSelected(null, function(curTab) {
				var tabInfos = tabMovementStatus[curTab.id];
				if (!tabInfos) {
					return;
				}
				chrome.windows.getAll({populate:true}, function(windows) {
					var relevantTabInfos = tabInfos.reverse().filter(function(tabInfo) {
						return windows.some(function(window) {
							return tabInfo.fromWindowId == window.id;
						});
					})
					if (!relevantTabInfos.length) {
						return;
					}
					var windowId = relevantTabInfos[0].fromWindowId; 
					targetParams = {
						windowId: windowId,
						index: relevantTabInfos[0].fromWindowIndex
					}
					chrome.tabs.move(curTab.id, targetParams, function(tabs){
						tabMovementStatus[curTab.id] = relevantTabInfos.slice(1);
						chrome.tabs.update(curTab.id,{selected:true},null);
						chrome.window.update(windowId, {focused: true}, null)
					});
				});
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
			},
			{
				"name": "MoveTabOut",
				"bind": "ctrl+alt+down"
			},
			{
				"name": "MoveTabIn",
				"bind": "ctrl+alt+up"
			},
		];
		resp("value", value);
	}
}


var module = (function(){
	var c = core;
	var cc = commandCore;

	var handlers = {
		"Tab": {
			"MoveTabLeft": [c.moveTabLeft],
			"MoveTabRight": [c.moveTabRight],
			"MoveTabLeftMost": [c.moveTabLeftMost],
			"MoveTabRightMost": [c.moveTabRightMost],
			"DuplicateTab": [c.duplicateTab],
			"PinTab": [c.pinTab],
			"MoveTabOut": [c.moveTabOut],
			"MoveTabIn": [c.moveTabIn],
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