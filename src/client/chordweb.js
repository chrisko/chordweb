// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

function ChordWeb() {
    this.id = Crypto.SHA1(Math.random().toString());
    this.initialize();
}

ChordWeb.prototype.initialize = function () {
    console.log("ChordWeb initialize!");
    console.log("id " + this.id);
};
