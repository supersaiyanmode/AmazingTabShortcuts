'use strict';

var tabStatus = {
	pinned: {},
	movement: {},
	mru: []
}

var core = (function(){
	return {
		moveTabLeft: function() {
			chrome.tabs.getSelected(null, function(tab){
				if (tab.index > 0) {
					chrome.tabs.move(tab.id,{index: tab.index-1},null);
				}
			});
		},
		moveTabRight: function() {
			chrome.tabs.getSelected(null, function(tab){
				chrome.tabs.move(tab.id,{index: tab.index+1},null);
			});
		},
		moveTabLeftMost: function() {
			chrome.tabs.getSelected(null, function(tab){
				if (tab.index > 0)
					chrome.tabs.move(tab.id,{index: 0},null);
			});
		},
		moveTabRightMost: function() {
			chrome.tabs.getSelected(null, function(tab){
				chrome.tabs.move(tab.id,{index: 1000},null); //max 1000
			});
		},
		moveTabOut: function() {
			chrome.tabs.getSelected(null, function(curTab) {
				chrome.windows.create({tabId:curTab.id}, function(window){
					if (!tabStatus.movement[curTab.id]) {
						tabStatus.movement[curTab.id] = [];
					}
					tabStatus.movement[curTab.id].push({
						fromWindowId: curTab.windowId,
						toWindowId: window.id,
						fromWindowIndex: curTab.index,
						tabId: curTab.id
					});
					chrome.tabs.update(curTab.id,{selected:true},null);
				});
			});
		},
		moveTabIn: function() {
			chrome.tabs.getSelected(null, function(curTab) {
				var tabInfos = tabStatus.movement[curTab.id];
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
						tabStatus.movement[curTab.id] = relevantTabInfos.slice(1);
						chrome.tabs.update(curTab.id,{selected:true},null);
						chrome.windows.update(windowId, {focused: true}, null)
					});
				});
			});
		},
		duplicateTab: function() {
			chrome.tabs.getSelected(null, function(tab){
				chrome.tabs.duplicate(tab.id, null);
			});	
		},
		pinTab: function() {
			chrome.tabs.getSelected(null, function(tab){
				if (!tab.pinned) {
					tabStatus.pinned[tab.id] = {index: tab.index};
					chrome.tabs.update(tab.id, {pinned: true}, null);
				} else {
					var info = tabStatus.pinned[tab.id];
					chrome.tabs.update(tab.id, {pinned: false}, null);
					if (info) {
						chrome.tabs.move(tab.id,{index: info.index},null);
					}
				}
			});
		},
		duplicateIncognito: function() {
			chrome.tabs.getSelected(null, function(tab){
				chrome.windows.create({incognito:true}, function(window) {
					chrome.tabs.query({windowId: window.id}, function(newTabs) {
						chrome.tabs.update(newTabs[0].id, {url: tab.url}, function() {});
					});
				});
			});
		},
		previousTab: function() {
			curActiveInfo = tabStatus.mru[1];
			if (!curActiveInfo) {
				return;
			}
			chrome.tabs.update(curActiveInfo.tabId,{selected:true},null);
			chrome.windows.update(curActiveInfo.windowId, {focused: true}, null);
		},
		horizontalResizeWindows: function() {
			
		},
	};
})();

var commandCore = {
	getCommands: function() {
		
	}
};

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
			"DuplicateIncognito": [c.duplicateIncognito],
			"PreviousTab": [c.previousTab]
		},
		"Control": {
			"GetCommands": [cc.getCommands],
		}
	};
	
	var callChain = function(fns, params, resp) {
		var total = fns.length;
		var response = {};
		fns.forEach(function(fn) {
			var callback = function (key, value) {
				total--;
				response[key] = value;
				if (total <= 0) {
					resp(response);
				}
			};
			var args = params.concat(callback);
			fn.apply(this, args);
		});
	}
	
	var tabSelectionChanged = function(activeInfo) {
		tabStatus.mru = [activeInfo].concat(tabStatus.mru.filter(function(x) {
			return x.tabId != activeInfo.tabId;
		}));
	};
	
	var tabRemoved = function(activeInfo) {
		tabStatus.mru = tabStatus.mru.filter(function(x) {
			return x.tabId != activeInfo.tabId;
		});
	};
		
	return {
		init: function() {
			chrome.commands.onCommand.addListener(function (command) {
				console.log("Command: " + command);
				callChain(handlers.Tab[command], [], function(val) {});
			});
			chrome.tabs.onActivated.addListener(tabSelectionChanged);
			chrome.tabs.onRemoved.addListener(tabRemoved);
		},
	};
}());

module.init();