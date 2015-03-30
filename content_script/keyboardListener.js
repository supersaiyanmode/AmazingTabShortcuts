function uuid(){
	var d = new Date().getTime();
	var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = (d + Math.random()*16)%16 | 0;
		d = Math.floor(d/16);
		return (c=='x' ? r : (r&0x3|0x8)).toString(16);
	});
	return uuid;
};

function messageManager(port){
	var messageQueue = {};
	
	port.onMessage.addListener(function(obj) {
		if (!messageQueue[obj.id]) {
			return;
		}
		
		var respFn = messageQueue[obj.id].respFn;
		
		delete messageQueue[obj.id];
		
		if (respFn) {
			respFn(obj.response);
		}
	});
	
	return {
		send: function(cmd, resp){
			var id = uuid()
			var obj = {
				id: id,
				command: cmd
			}
			messageQueue[id] = {respFn: resp}
			port.postMessage(obj);
		}
	}
};


var client = (function(){
	var tabPort = chrome.runtime.connect({name:"Tab"});
	var tabMessaging = messageManager(tabPort);
	
	var controlPort = chrome.runtime.connect({name:"Control"});
	controlMessaging = messageManager(controlPort);
	
	var commands;
	
	return {
		init: function(doneFn) {
			controlMessaging.send({name:"GetCommands"},function(cmd){
				commands = cmd.value;
				doneFn();
			});
		},
		commands: function() {
			return commands;
		},
		process: function(command) {
			tabMessaging.send({name:command}, function(resp){});
		}
	};
}());

var mouseTrap = (function(){
	return {
		init: function(commands, callback, doneFn) {
			Mousetrap.reset();
			Object.keys(commands).forEach(function(cmd) {
				Mousetrap.bind(commands[cmd].bind, function(event) {
					callback(cmd);
				});
			})
			doneFn();
		}
	}
}())

var init = function(){
	client.init(function(){
		mouseTrap.init(client.commands(), client.process, function(){});
	});
};

init();

chrome.storage.onChanged.addListener(function(changes, namespace) {
	//console.log("Storage has changed. Reloading..");
	init();
});