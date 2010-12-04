if (!document.getElementById('sharkzapperInject')) {

	chrome.extension.sendRequest({"command": "getTabCount"});

	function receiveMessage(e) {
		var request = JSON.parse(e.data);
		switch (request.command) {
			case 'contentScriptInit':
			case 'statusUpdate':
			case 'firstTabNavigate':
				chrome.extension.sendRequest(request);
		}
	}
	window.addEventListener("message", receiveMessage, false);  

	chrome.extension.onRequest.addListener(
		function(request, sender, sendResponse) {
			switch (request.command) {
				case 'prevSong':
				case 'pauseSong':
				case 'resumeSong':
				case 'nextSong':
				case 'updateStatus':
				case 'toggleMute':
				case 'performSearch':
					window.postMessage(JSON.stringify(request), "http://listen.grooveshark.com");
					break;
				case 'tabCount':
					console.log('There are ' + request.tabCount + ' open grooveshark tabs!');
					if (request.tabCount != 1) {
						if (!document.getElementById('sharkzapper_warning_bar')) {
							warn = document.createElement('div');
							warn.id = 'sharkzapper_warning_bar';
							warn.innerHTML = '<div style="position: absolute; top: 0px; z-index: 100000; color: black; width: 100%; text-align: center; font-size: 120%; padding: 12px; background-color: rgba(255, 255, 224, 0.8); ">Grooveshark is alredy open in <a href="javascript:window.postMessage(JSON.stringify({\'command\':\'firstTabNavigate\'}), \'http://listen.grooveshark.com\'); ">another tab</a>, please close this tab if you wish to use SharkZapper. <span style="float:right; margin-right: 24px;"><a href="javascript:document.body.removeChild(document.getElementById(\'sharkzapper_warning_bar\'));">close</a></span></div>';
							document.body.appendChild(warn);
						}
						if (document.getElementById('sharkzapperInject')) { document.body.removeChild(document.getElementById('sharkzapperInject')); }
					}
					break;
			}
		}
	);

	inject = document.createElement('script');
	inject.id = 'sharkzapperInject'; //if($('#player_play_pause').hasClass('pause'))
	inject.innerHTML = 'function sharkzapper_update_status() { 					\
							sharkzapper_post_message({							\
								"command": "statusUpdate",						\
								"playbackStatus": GS.player.getPlaybackStatus(),\
								"currentSong": GS.player.currentSong,			\
								"prevSong": GS.player.queue.previousSong,		\
								"nextSong": GS.player.queue.nextSong,			\
								"isPlaying": GS.player.isPlaying,				\
								"isPaused": GS.player.isPaused,					\
								"isMuted": GS.player.getIsMuted()				\
							});													\
						} 														\
						function sharkzapper_post_message(message) {			\
							message.source = "page";							\
							window.postMessage(JSON.stringify(message), "http://listen.grooveshark.com"); \
						}														\
						window.addEventListener("message", function(e){ 		\
							if (e.origin == "http://listen.grooveshark.com") { 	\
								var request = JSON.parse(e.data); 				\
								if (request.source == "page") { return; } 		\
								console.log("sharkzapper:", "<<<", request);	\
								switch (request.command) { 						\
									case "pauseSong": 							\
										GS.player.pauseSong(); 					\
										break;									\
									case "resumeSong": 							\
										GS.player.resumeSong(); 				\
										break;									\
									case "prevSong":							\
										GS.player.previousSong(); 				\
										break; 									\
									case "nextSong":							\
										GS.player.nextSong(); 					\
										break; 									\
									case "updateStatus":						\
										sharkzapper_update_status();			\
										break; 									\
									case "toggleMute":							\
										$("#player_volume").click();			\
										sharkzapper_update_status();			\
										break;									\
									case "performSearch":						\
										GS.router.performSearch("all",request.query); \
										break;									\
								} 												\
							}													\
						}, false); 												\
						sharkzapper_post_message({"command":"contentScriptInit"});			\
						$.subscribe("gs.player.nowplaying",sharkzapper_update_status);		\
						$.subscribe("gs.player.queue.change",sharkzapper_update_status);	\
						$.subscribe("gs.player.playing.continue",sharkzapper_update_status);\
						$.subscribe("gs.player.paused",sharkzapper_update_status);';
	document.body.appendChild(inject);

} else {
	console.log('sharkzapper already injected, aborting!');			
}
