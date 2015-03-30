//TODO: Clean up. Next 4-5 functions have been copied keyboardListener.js

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
			console.log("No such id in memory: " + obj.id);
			return;
		}
		
		var respFn = messageQueue[obj.id].respFn;
		
		delete messageQueue[obj.id];
		
		if (respFn) {
			//console.log("Got generic response from backend:", obj);
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
			//console.log("Send message to backend: ", obj);
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
			
			controlMessaging.send({name:"GetCommands"},function(cmd){
				console.log("Commands from backend: ", cmd);
				commands = cmd.value;
				doneFn();
			});
		},
		commands: function() {
			return commands;
		},
		updateCommands: function(cmdObj, resp) {
			controlMessaging.send({name:"SetCommands", commands: cmdObj},function(response){
				console.log("Response from backend: ", response);
				resp(response);
			});
		},
		process: function(command) {
			tabMessaging.send({name:command}, function(resp){});
		}
	};
}());

var mouseTrap = (function(){
	return {
		init: function(commands, callback, doneFn) {
			console.log("MouseTrap::init(): ", commands);
			Mousetrap.reset();
			Object.keys(commands).forEach(function(cmd) {
				Mousetrap.bind(commands[cmd].bind, function(event) {
					callback(cmd);
				});
			})
			doneFn();
		}
	}
}());

var app = angular.module("app", ['ngRoute']);

app.controller("OptionsController", function($scope) {
	console.log("Here!");
	var highlightFn = function(name) {
		$scope[name + "_highlight"] = "red";
		$scope.$apply();
		setTimeout(function() {
			$scope[name + "_highlight"] = "";
			$scope.$apply();
		}, 750);
	}
	client.init(function(){
		var commands = client.commands();
		$scope.commands = commands;
		$scope.$apply();
		mouseTrap.init(commands, highlightFn, function(){});
	});
	
	
	$scope.save = function() {
		client.updateCommands($scope.commands, function(res) {
			alert("Done!");
		})
	}
});