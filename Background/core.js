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
						chrome.windows.update(windowId, {focused: true}, null)
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
		duplicateIncognito: function() {
			chrome.tabs.getSelected(null, function(tab){
				chrome.windows.create({incognito:true}, function(window) {
					chrome.tabs.query({windowId: window.id}, function(newTabs) {
						chrome.tabs.update(newTabs[0].id, {url: tab.url}, function() {});
					});
				})
			});
		},
		horizontalResizeWindows: function() {
			
		},
	};
})();

var keyBindingManager = (function() {
	var keyBindings = {
		"MoveTabLeft" : {
			"bind": "ctrl+shift+left",
			"description": "Moves the current tab to the left by one position."
		},
		"MoveTabRight":{
			"bind": "ctrl+shift+right",
			"description": "Moves the current tab to the right by one position."
			
		},
		"MoveTabLeftMost": {
			"bind": "ctrl+shift+alt+left",
			"description": "Moves the current tab to the leftmost position."
		},
		"MoveTabRightMost": {
			"bind": "ctrl+shift+alt+right",
			"description": "Moves the current tab to the rightmost position."
		},
		"DuplicateTab": {
			"bind": "ctrl+shift+command+d",
			"description": "Duplicates the current tab."
		},
		"PinTab": {
			"bind": "ctrl+shift+command+p",
			"description": "Pins/unpins the current tab."
		},
		"MoveTabOut": {
			"bind": "ctrl+alt+down",
			"description": "Moves the tab out into a new window."
		},
		"MoveTabIn": {
			"bind": "ctrl+alt+up",
			"description": "Moves the tab back into the same window it was moved out from."
		},
		"DuplicateIncognito": {
			"bind": "ctrl+shift+command+n",
			"description": "Duplicate the current page in incognito mode."
		},
	};
	
	var readStorage = function(resp) {
		chrome.storage.sync.get(null, function(items) {
			Object.keys(items).filter(function(x) {
					return x.startsWith("key_");
				}).forEach(function(key) {
					keyBindings[key.slice(4)].bind = items[key].bind || null;
				});
			var copy = JSON.parse(JSON.stringify(keyBindings));
			console.log("Done reading config from store:", copy);
			resp(copy);
		});
	};
	
	var writeStorage = function(obj, resp) {
		var copy = {};
		Object.keys(obj).forEach(function (key) {
			copy["key_" + key] = {"bind": obj[key].bind || null};
		});
		chrome.storage.sync.set(copy, function() {
			readStorage(resp);
		});
	};
	
	var stale = true;
	
	return {
		get: function(resp) {
			if (!stale) {
				resp(JSON.parse(JSON.stringify(keyBindings)));
			} else {
				readStorage(function(obj) {
					stale = false;
					resp(obj);
				})
			}
		},
		set: function(obj, resp) {
			var copy = JSON.parse(JSON.stringify(keyBindings));
			Object.keys(obj)
				.filter(function(x){return keyBindings.hasOwnProperty(x);})
				.forEach(function(binding) {
					copy[binding] = obj[binding];
				});
			writeStorage(copy, resp);
		}
		
	}
})();

var commandCore = {
	listCommands: function(cmd, event, resp) {
		keyBindingManager.get(function (val) {
			resp("value", val);
		})
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
			"DuplicateIncognito": [c.duplicateIncognito]
		},
		"Control": {
			"GetCommands": [cc.listCommands]
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
		
	return {
		init: function() {
			chrome.extension.onConnect.addListener(function(port) {
				if (!(port.name in handlers)) {
					return;
				}
				port.onMessage.addListener((function(handler) {
					return function(obj) {
						var event = obj.event, command = obj.command, id = obj.id;
						callChain(handler[command.name],[command, event], function(val) {
							//console.log("Sending response to tab: ", obj);
							port.postMessage({id: obj.id, response: val});
						});
					}
				})(handlers[port.name]));
			});
		},
	};
}());

module.init();