if (!document.getElementById('sharkzapperInject')) {

	function receiveMessage(e) {
		var request = JSON.parse(e.data);
		switch (request.command) {
			case 'contentScriptInit':
			case 'statusUpdate':
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
					window.postMessage(JSON.stringify(request), "http://listen.grooveshark.com");
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
