# StatiCrypt

Based on the [crypto-js](https://github.com/brix/crypto-js) library, StatiCrypt uses AES-256 to encrypt your string with your passphrase in your browser (client side).

Download your encrypted string in a HTML page with a password prompt you can upload anywhere (see [example](https://robinmoisson.github.io/staticrypt/example.html)).

You can encrypt a file online at https://robinmoisson.github.io/staticrypt.

## HOW IT WORKS

StatiCrypt generates a static, password protected page that can be decrypted in-browser: just send or upload the generated page to a place serving static content (github pages, for example) and you're done: the javascript will prompt users for password, decrypt the page and load your HTML.

**Disclaimer** TL;DR: if you have extra sensitive banking data you should probably use something else :)

StatiCrypt basically encrypts your page and puts everything with a user-friendly way to use a password in the new file. 

AES-256 is state of the art but brute-force/dictionary attacks would be trivial to do at a really fast pace: **use a long, unusual passphrase!**

The concept is simple but this is a side project - not purporting to be bulletproof, feel free to contribute or report any thought to the GitHub project !

