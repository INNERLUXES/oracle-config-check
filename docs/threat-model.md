# Threat model

The tool is an input to a review before the protocol is deployed: not a security audit and not a guarantee that the
oracle of the protocol cannot be manipulated or fail. This document is about the tool itself: what it touches, what a
hostile or careless configuration file can try, and what stops it.

## What the tool touches

- It reads the one file named on the command line. Nothing else is opened, and no address or path written in the
  configuration is followed.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, fetches no URL, contacts no chain or RPC endpoint, follows no symbolic link, runs
  nothing it reads, evaluates nothing and reads no clock and no locale.

## What the input may hold

The configuration comes from a repository, and in a pipeline that checks every pull request it may be written by
whoever opened the pull request. Through it, a person can try to, or a careless change can:

- put a private key, a seed or a mnemonic in the file, so that the tool copies it into a pipeline log, a pull request
  comment or a code scanning upload;
- make the tool read outside the file: a link named on the command line, a folder, an address given as the path;
- make the tool reach a chain: an address of a feed or an endpoint written in the configuration;
- exhaust the memory, the stack or the time: a file of many megabytes, arrays and objects nested very deep, millions of
  values, very long strings, numbers with thousands of digits, thousands of assets that are all compared with each
  other;
- move the result: a key written twice so that two readers see two values, a misspelt key that hides a staleness
  threshold, a value of the wrong type that might be taken as fine, a price that a floating point number would round
  across a bound;
- slip in something that is not text: a binary file named `.json`, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, escape sequences, direction controls and line separators
  in a protocol name, an asset, a network or an address;
- hide markup in the markdown report: a link, a table separator or a tag in a name;
- change how objects behave: a key or an asset named `__proto__`, `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A key or a seed in the file is copied into the output | Before the configuration is read, every key and every string is looked at; a key named for a key or a seed, and a string shaped like one, is a `secret-in-config` error, the value is marked, the reader leaves it out as if it were not there, and no message names it. Tests put each shape under several fields and check every format for the value |
| A link makes the tool read a file it was not given | The path is checked with `lstat` and a link is refused by name; the file is opened with `O_NOFOLLOW` where the system has it, and its type and size are taken from the open handle. A test puts a link in the folder |
| The tool reaches a chain, fetches, connects or runs something | No module of the network or of child processes is imported, nothing is evaluated, an address in the file is only text that is checked for its form, and a path that looks like an address is refused. A test checks the imports of src |
| The memory, the stack or the time is exhausted | The file has a size limit checked on the open handle before it is read; the JSON reader and the search for keys keep stacks of their own, with limits of nesting, values and string length; assets have a limit of 1,000, answer checks of 20 and decimals of 40 digits a side. Tests check the time, with limits that widen under coverage only |
| A key written twice hides a value | A key written twice in one object is a `config-unreadable` finding; the tool never picks one of the two |
| A misspelt or missing field passes for one that is fine | A key the tool does not read is a `field-unknown` finding with the key it is probably meant to be; a missing field is `field-missing`; a value of the wrong type is `field-invalid`; each with its line. A missing staleness threshold or bound is a finding of its own |
| A price is rounded across a bound | Prices, percents and bounds are read from the characters of the file into a whole number and a scale and compared with BigInt; an exponent or a sign is refused |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes in UTF-16 and bytes that are not valid make the file an input error with exit code `2` and no report |
| Text from the file rewrites the terminal | Every text from the input goes through `safeText`, which replaces control, line separator and direction characters and caps the length. A test puts escapes and direction controls in a protocol, an asset, a network and an address, in every format |
| Markup in a name changes the markdown report | The markdown report escapes the characters markdown gives a meaning to. A test writes a link into an asset name |
| `__proto__` changes how objects behave | Objects of a file are lists of entries compared with the names the tool reads, and no object is built with a key from a file. A test uses `__proto__`, `constructor`, `toString` and `hasOwnProperty` as names |
| A device or a pipe hangs the tool | A path that is not a regular file is refused before it is read |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether the contracts read the feeds as the configuration says, whether a feed address is the feed of its pair, the
keys and seeds the search does not recognise (docs/limits.md), the forms docs/limits.md leaves out, who may change the
configuration in your repository, and where your pipeline keeps the output.
