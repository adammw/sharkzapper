if (!document.getElementById('sharkzapperInject')) {

	function receiveMessage(e) {
		var request = JSON.parse(e.data);
		switch (request.command) {
			case 'contentScriptInit':
				console.log('Got contentScriptInit!');
		}
	}
	window.addEventListener("message", receiveMessage, false);  

	chrome.extension.onRequest.addListener(
		function(request, sender, sendResponse) {
			switch (request.command) {
				case 'prevSong':
				case 'pauseSong':
				case 'nextSong':
					window.postMessage(JSON.stringify(request), "http://listen.grooveshark.com");
			}
		}
	);

	inject = document.createElement('script');
	inject.id = 'sharkzapperInject';
	inject.innerHTML = 'window.addEventListener("message", function(e){ if (e.origin == "http://listen.grooveshark.com") { var request = JSON.parse(e.data); console.log("sharkzapper:", request); switch (request.command) { case "pauseSong": GS.player.pauseSong(); break; case "nextSong": GS.player.nextSong(); break; } } }, false); window.postMessage(JSON.stringify({"command":"contentScriptInit"}), "http://listen.grooveshark.com");';
	document.body.appendChild(inject);

} else {
	console.log('sharkzapper already injected, aborting!');
}
