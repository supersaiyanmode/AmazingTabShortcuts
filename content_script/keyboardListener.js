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
		var event = messageQueue[obj.id].event;
		
		delete messageQueue[obj.id];
		
		if (obj.response.event === false) {
			event.preventDefault();
		}
		if (respFn) {
			respFn(obj.response);
		}
	});
	
	return {
		send: function(evt, cmd, resp){
			var id = uuid()
			var obj = {
				id: id,
				command: cmd
			}
			messageQueue[id] = {respFn: resp, event: evt}
			port.postMessage(obj);
		}
	}
};


var client = (function(){
	var tabMessaging, controlMessaging;
	
	var commands;
	
	return {
		init: function(doneFn) {
			var tabPort = chrome.runtime.connect({name:"Tab"});
			var controlPort = chrome.runtime.connect({name:"Control"});
			tabMessaging = messageManager(tabPort);
			controlMessaging = messageManager(controlPort);
			
			controlMessaging.send(null,{name:"Commands"},function(cmd){
				commands = cmd.value;
				doneFn();
			});
		},
		commands: function() {
			return commands;
		},
		process: function(event, command) {
			tabMessaging.send(event, {name:command}, function(resp){});
		}
	};
}());

var mouseTrap = (function(){
	return {
		init: function(commands, callback, doneFn) {
			Mousetrap.reset();
			commands.forEach(function(cmd) {
				Mousetrap.bind(cmd.bind, function(event) {
					callback(event, cmd.name);
				});
			})
			doneFn();
		}
	}
}())

client.init(function(){
	mouseTrap.init(client.commands(), client.process, function(){});
});