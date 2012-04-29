// Chris Koenig <ckoenig@seas.upenn.edu>
// CIS-553 Extra Credit, Spring 2012

// http://stackoverflow.com/questions/2967332/jquery-plugin-for-event-driven-architecture
function EventBus() { }

EventBus.prototype.subscribe = function (event_string, fn) {
    $(this).bind(event_string, fn);
};

EventBus.prototype.publish = function (event_string) {
    $(this).trigger(event_string);
}
