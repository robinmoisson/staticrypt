![password prompt preview](preview.png)

# StatiCrypt

StatiCrypt uses AES-256 to encrypt your HTML file with your passphrase and return a static page including a password prompt and the javascript decryption logic that you can safely upload anywhere (see [what the page looks like](https://robinmoisson.github.io/staticrypt/example/example_encrypted.html)).

This means you can **password protect the content of your _public_ static HTML file, without any back-end** - serving it over Netlify, GitHub pages, etc. (see the detail of [how it works](#how-staticrypt-works)).

You can encrypt a file online in your browser (client side) at https://robinmoisson.github.io/staticrypt, or use the CLI to do it in your build process.

## CLI

### Installation

Staticrypt is available through npm as a CLI, install with

```bash
npm install staticrypt
```

You can then run it with `npx staticrypt ...`. You can also install globally with `npm install -g staticrypt` and then just call `staticrypt ...`.

### Examples

> These will create a `.staticrypt.json` file in the current directory, see the FAQ as to why. You can prevent it by setting the `--config` flag to "false".

**Encrypt a file:** Encrypt `test.html` and create a `test_encrypted.html` file (add `-o my_encrypted_file.html` to change the name of the output file):

```bash
staticrypt test.html MY_PASSPHRASE
```

**Encrypt a file with the passphrase in an environment variable:** set your passphrase in the `STATICRYPT_PASSWORD` environment variable ([`.env` files](https://www.npmjs.com/package/dotenv#usage) are supported):

```bash
# the passphrase is in the STATICRYPT_PASSWORD env variable
staticrypt test.html
```

**Encrypt a file and get a shareable link containing the hashed password** - you can include your file URL or leave blank:

```bash
# you can also pass '--share' without specifying the URL to get the `?staticrypt_pwd=...` 
staticrypt test.html MY_PASSPHRASE --share https://example.com/test_encrypted.html
# => https://example.com/test_encrypted.html?staticrypt_pwd=5bfbf1343c7257cd7be23ecd74bb37fa2c76d041042654f358b6255baeab898f
```

**Encrypt all html files in a directory** and replace them with encrypted versions (`{}` will be replaced with each file name by the `find` command - if you wanted to move the encrypted files to an `encrypted/` directory, you could use `-o encrypted/{}`):

```bash
find . -type f -name "*.html" -exec staticrypt {} MY_PASSPHRASE -o {} \;
```

**Encrypt all html files in a directory except** the ones ending in `_encrypted.html`:

```bash
find . -type f -name "*.html" -not -name "*_encrypted.html" -exec staticrypt {} MY_PASSPHRASE \;
```

### CLI Reference

The passphrase argument is optional if `STATICRYPT_PASSWORD` is set in the environment or `.env` file.

    Usage: staticrypt <filename> [<passphrase>] [options]

    Options:
          --help                    Show help                              [boolean]
          --version                 Show version number                    [boolean]
      -c, --config                  Path to the config file. Set to "false" to
                                    disable.  [string] [default: ".staticrypt.json"]
          --decrypt-button          Label to use for the decrypt button. Default:
                                    "DECRYPT".         [string] [default: "DECRYPT"]
      -e, --embed                   Whether or not to embed crypto-js in the page
                                    (or use an external CDN).
                                                           [boolean] [default: true]
      -f, --file-template           Path to custom HTML template with passphrase
                                    prompt.
                                   [string] [default: "/lib/password_template.html"]
      -i, --instructions            Special instructions to display to the user.
                                                              [string] [default: ""]
          --label-error             Error message to display on entering wrong
                                    passphrase.  [string] [default: "Bad password!"]
          --noremember              Set this flag to remove the "Remember me"
                                    checkbox.             [boolean] [default: false]
      -o, --output                  File name/path for the generated encrypted file.
                                                            [string] [default: null]
          --passphrase-placeholder  Placeholder to use for the passphrase input.
                                                      [string] [default: "Password"]
      -r, --remember                Expiration in days of the "Remember me" checkbox
                                    that will save the (salted + hashed) passphrase
                                    in localStorage when entered by the user.
                                    Default: "0", no expiration.
                                                               [number] [default: 0]
          --remember-label          Label to use for the "Remember me" checkbox.
                                                   [string] [default: "Remember me"]
      -s, --salt                    Set the salt manually. It should be set if you
                                    want to use "Remember me" through multiple
                                    pages. It needs to be a 32-character-long
                                    hexadecimal string.
                                    Include the empty flag to generate a random salt
                                    you can use: "statycrypt -s".           [string]
          --share                   Get a link containing your hashed password that
                                    will auto-decrypt the page. Pass your URL as a
                                    value to append "?staticrypt_pwd=<hashed_pwd>",
                                    or leave empty to display the hash to append.
                                                                            [string]
      -t, --title                   Title for the output HTML page.


## HOW STATICRYPT WORKS

So, how can you password protect html without a back-end?

StatiCrypt uses the [crypto-js](https://github.com/brix/crypto-js) library to generate a static, password protected page that can be decrypted in-browser. You can then just send or upload the generated page to a place serving static content (github pages, for example) and you're done: the page will prompt users for a password, and the javascript will decrypt and load your HTML, all done in the browser.

So it basically encrypts your page and puts everything in a user-friendly way to use a password in the new file.

## FAQ

### Is it secure?

Simple answer: your file content has been encrypted with AES-256 (CBC), a popular and strong encryption algorithm, you can now upload it in any public place and no one will be able to read it without the password. So yes, if you used a good password it should be pretty secure.

That being said, actual security always depends on a number of factors and on the threat model you want to protect against. Because your full encrypted file is accessible client side, brute-force/dictionary attacks would be trivial to do at a really fast pace: **use a long, unusual password**. You can read a discussion on CBC mode and how appropriate it is in the context of StatiCrypt in [#19](https://github.com/robinmoisson/staticrypt/issues/19).

**Also, disclaimer:** I am not a cryptographer - the concept is simple and I try my best to implement it correctly but please adjust accordingly: if you are an at-risk activist or have sensitive crypto data to protect, you might want to use something else.

### Can I customize the password prompt?

Yes! Just copy `lib/password_template.html`, modify it to suit your style and point to your template file with the `-f path/to/my/file.html` flag. Be careful to not break the encrypting javascript part, the variables replaced by StatiCrypt are between curly brackets: `{salt}`.

### Can I remove the "Remember me" checkbox?

If you don't want the checkbox to be included, you can add the `--noremember` flag to disable it.

### Why do we embed the whole crypto-js library in each encrypted file by default?

Some adblockers used to see the `crypto-js.min.js` served by CDN, think that's a crypto miner and block it. If you don't want to include it and serve from a CDN instead, you can add `--embed false`.

### Why does StatiCrypt create a config file?

The "Remember me" feature stores the user password hashed and salted in the browser's localStorage, so it needs the salt to be the same each time you encrypt otherwise the user would be logged out when you encrypt the page again. The config file is a way to store the salt in between runs, so you don't have to remember it and pass it manually.

When deciding what salt to use, StatiCrypt will first look for a `--salt` flag, then try to get the salt from the config file, and if it still doesn't find a salt it will generate a random one. It then saves the salt in the config file.

If you don't want StatiCrypt to create or use the config file, you can set `--config false` to disable it.

The salt isn't secret, so you don't need to worry about hiding the config file.

### How does the "Remember me" checkbox work?

The CLI will add a "Remember me" checkbox on the password prompt by default (`--noremember` to disable). If the user checks it, the (salted + hashed) passphrase will be stored in their browser's localStorage and the page will attempt to auto-decrypt when they come back.

If no value is provided the stored passphrase doesn't expire, you can also give it a value in days for how long should the store value be kept with `-r NUMBER_OF_DAYS`. If the user reconnects to the page after the expiration date the stored value will be cleared.

#### "Logging out"

You can clear StatiCrypt values in localStorage (effectively "logging out") at any time by appending `staticrypt_logout` to the URL query parameters (`mysite.com?staticrypt_logout`).

#### Encrypting multiple pages

This allows encrypting multiple page on a single domain with the same password: if you check "Remember me", you'll have to enter your password once then all the pages on that domain will automatically decrypt their content. Because the hashed value is stored in the browser's localStorage, this will only work if all the pages are on the same domain name.

#### Is the "Remember me" checkbox secure?

In case the value stored in the browser becomes compromised an attacker can decrypt the page, but because it's stored salted and hashed this should still protect against password reuse attacks if you've used the passphrase on other websites (of course, please use a unique passphrase nonetheless).

## Contributing

### 🙏 Thank you!

- [@AaronCoplan](https://github.com/AaronCoplan) for bringing the CLI to life
- [@epicfaace](https://github.com/epicfaace) & [@thomasmarr](https://github.com/thomasmarr) for sparking the caching of the passphrase in localStorage (allowing the "Remember me" checkbox)
- [@hurrymaplelad](https://github.com/hurrymaplelad) for refactoring a lot of the code and making the project much more pleasant to work with

### Opening PRs and issues

You're free to open PRs if you're ok with having no response for a (possibly very) long time and me possibly ending up getting inspiration from your proposal but merging something different myself (I'll try to credit you though). Apologies in advance for the delay, and thank you!

It's fine to open issues with suggestions and bug reports.

If you find a serious security bug please open an issue, I'll try to fix it relatively quickly.

### Guidelines to contributing

#### Source map

- `cli/` - The command-line interface published to NPM.
- `example/` - Example encrypted files, used as an example in the public website and for manual testing.
- `lib/` - Files shared across www and cli.
- `scripts/` - Build, test, deploy, CI, etc. See `npm run-script`.
- `index.html` - The root of the in-browser encryption site hosted at https://robinmoisson.github.io/staticrypt. Kept in the root of the repo for easy deploys to GitHub Pages.

#### Build

Built assets are committed to main. Run build before submitting a PR or publishing to npm.

```
npm install
npm run build
```

#### Test

The testing is done manually for now - run [build](#build), then open `example/example_encypted.html` and check everything works correctly.

## Community and alternatives

Here are some other projects and community resources you might find interesting (this is included as an informative section, I haven't personally vetted any of those).

### Alternatives to StatiCrypt

[MaxLaumeister/PageCrypt](https://github.com/MaxLaumeister/PageCrypt) is a project with similar features in a different style (I think it was created before StatiCrypt).

### Based on StatiCrypt

**WebCrypto:** https://github.com/tarpdalton/staticrypt/tree/webcrypto is a fork that uses the WebCrypto browser api to encrypt and decrypt the page, which removes the need for `crypto-js`. There's a PR open towards here which I haven't checked in detail yet. WebCrypto is only available in HTTPS context (which [is annoying people](https://github.com/w3c/webcrypto/issues/28)) so it won't work if you're on HTTP.

**Template to host an encrypted single page website with Github Pages:** [a-nau/password-protected-website-template](https://github.com/a-nau/password-protected-website-template) is a demonstration of how to build a protected page on Github Pages, integrating with Github Actions
