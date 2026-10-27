/* Feedback form on the Games side (feedback.html, cs/feedback.html, sk/feedback.html).
   The site has no server, so a message goes out one of two ways:
     1. Web3Forms (preferred): put your access key below and messages arrive straight in your inbox.
        Get a free key at https://web3forms.com by entering the address that should receive them.
     2. Without a key: "Send" opens the visitor's email app with the message ready to send.
   All texts come from data-* attributes on the <form>, so this file works for every language. */
(function () {
  var WEB3FORMS_KEY = '3bae89a1-9020-43b2-8fe9-581468327042';   // Web3Forms access key (public by design); empty = use the email app
  var TO = 'bezak84.martin@gmail.com';            // the same address as on the professional profile

  var form = document.querySelector('[data-feedback]');
  if (!form) return;
  var status = form.querySelector('[data-status]');
  var note = form.querySelector('[data-mail-note]');
  var d = form.dataset;

  if (WEB3FORMS_KEY && note) note.hidden = true;  // the "opens your email app" hint only applies without a key

  function say(text, ok) {
    status.textContent = text;
    status.classList.toggle('is-ok', !!ok);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var topicEl = form.querySelector('input[name="topic"]:checked');
    var topic = topicEl ? topicEl.value : '';
    var topicLabel = topicEl ? topicEl.getAttribute('data-label') : '';
    var message = form.message.value.trim();
    var name = form.name.value.trim();
    var email = form.email.value.trim();

    if (message.length < 5) { say(d.msgEmpty); form.message.focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(d.msgEmail); form.email.focus(); return; }
    if (form.botcheck && form.botcheck.checked) return;   // hidden field only bots tick

    var subject = d.subject + (topicLabel ? ': ' + topicLabel : '');
    var page = document.referrer && document.referrer.indexOf(location.origin) === 0
      ? document.referrer.replace(location.origin, '') : '';

    if (WEB3FORMS_KEY) {
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      say(d.msgSending);
      // Sent as form data, not JSON: a "simple" request needs no CORS preflight, which Web3Forms rejects
      var data = new FormData();
      var fields = { access_key: WEB3FORMS_KEY, subject: subject, from_name: name || 'Website visitor',
        name: name, email: email, topic: topic, message: message, came_from: page, language: document.documentElement.lang };
      Object.keys(fields).forEach(function (k) { data.append(k, fields[k]); });
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data
      }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.success) throw new Error(res.message);
        form.reset();
        say(d.msgSent, true);
      }).catch(function () {
        say(d.msgFailed);
      }).then(function () { btn.disabled = false; });
      return;
    }

    // No key: hand the message to the visitor's email app
    var body = message + '\n\n— ' + (name || '') + (email ? ' <' + email + '>' : '') +
      (topicLabel ? '\n' + d.topicWord + ': ' + topicLabel : '') + (page ? '\n' + page : '');
    location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    say(d.msgMail, true);
  });
})();
