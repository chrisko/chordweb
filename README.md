ChordWeb
========

ChordWeb is a browser-based implementation of the Chord distributed hash table,
as described in Stoica et al.'s 2001 paper "Chord: A scalable peer-to-peer
lookup service for internet applications".

![Chordweb UI](http://chrisko.github.com/chordweb/chordweb.png)

The browser-based clients communicate with the server via
[socket.io](http://socket.io/), which routes the traffic between clients.

Installation
------------

The module's built around npm, so the typical `npm install` and `npm start`
should function properly, provided you have [node](http://nodejs.org/) and
[npm](http://npmjs.org/) installed.

Incomplete
----------

* Lookup requests.
* Finger table.
