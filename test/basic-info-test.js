const ytdl = require('..');
const assert = require('assert-diff');
const nock = require('./nock');
const miniget = require('miniget');


describe('ytdl.getBasicInfo()', () => {
  let minigetDefaults = miniget.defaultOptions;
  before(() => miniget.defaultOptions = Object.assign({}, minigetDefaults, { maxRetries: 0 }));
  after(() => miniget.defaultOptions = minigetDefaults);

  describe('From a regular video', () => {
    it('Retrieves correct metainfo', async() => {
      const expected = require('./files/videos/regular/expected-info.json');
      const id = '_HSylqgVYQI';
      const scope = nock(id, 'regular', {
        watchHtml: false,
        player: false,
      });
      let info = await ytdl.getBasicInfo(id);
      scope.done();
      assert.ok(info.videoDetails.shortDescription.length);
      assert.strictEqual(info.formats.length, expected.formats.length);
    });

    it('Retrieves just enough metainfo', async() => {
      const id = '5qap5aO4i9A';
      const expected = require('./files/videos/live-now/expected-info.json');
      const scope = nock(id, 'live-now', {
        watchHtml: false,
        player: false,
        dashmpd: false,
        m3u8: false,
      });
      let info = await ytdl.getBasicInfo(id);
      scope.done();
      assert.notStrictEqual(info.formats.length, expected.formats.length);
    });

    describe('Use `ytdl.downloadFromInfo()`', () => {
      it('Throw error', async() => {
        const id = '5qap5aO4i9A';
        const scope = nock(id, 'regular', {
          watchHtml: false,
          player: false,
        });
        let info = await ytdl.getBasicInfo(id);
        scope.done();
        assert.throws(() => {
          ytdl.downloadFromInfo(info);
        }, /Cannot use/);
      });
    });

    describe('Pass request options', () => {
      it('Request gets called with more headers', async() => {
        const id = '_HSylqgVYQI';
        const scope = nock(id, 'regular', {
          headers: { 'X-Hello': '42' },
          watchHtml: false,
          player: false,
        });

        await ytdl.getBasicInfo(id, {
          requestOptions: { headers: { 'X-Hello': '42' } },
        });
        scope.done();
      });
    });

    describe('Called twice', () => {
      it('Makes requests once', async() => {
        const expected = require('./files/videos/regular/expected-info.json');
        const id = '_HSylqgVYQI';
        const scope = nock(id, 'regular', {
          watchHtml: false,
          player: false,
        });
        let info1 = await ytdl.getBasicInfo(id);
        assert.ok(info1.videoDetails.shortDescription.length);
        assert.strictEqual(info1.formats.length, expected.formats.length);
        let info2 = await ytdl.getBasicInfo(id);
        scope.done();
        assert.strictEqual(info2, info1);
      });
    });
  });

  describe('From an age restricted video', () => {
    it('Returns correct video metainfo with formats', async() => {
      const expected = require('./files/videos/age-restricted/expected-info.json');
      const id = 'LuZu9N53Vd0';
      const scope = nock(id, 'age-restricted');
      let info = await ytdl.getBasicInfo(id);
      scope.done();
      assert.strictEqual(info.formats.length, expected.formats.length);
      assert.ok(info.videoDetails.age_restricted);
      assert.ok(info.formats.length);
    });
  });

  describe('From a video that was live streamed but not currently live', () => {
    it('Returns correct video metainfo', async() => {
      const id = 'nu5uzMXfuLc';
      const scope = nock(id, 'live-past');
      let info = await ytdl.getBasicInfo(id);
      scope.done();
      assert.strictEqual(info.formats.length, 10);
    });
  });

  describe('From a video that is not embeddable outside of YouTube', () => {
    it('Returns correct video metainfo', async() => {
      const id = 'GFg8BP01F5Q';
      const scope = nock(id, 'no-embed');
      let info = await ytdl.getBasicInfo(id);
      scope.done();
      assert.ok(info.formats.length);
    });
  });

  describe('From videos without formats', () => {
    describe('Rental video', () => {
      it('Gets video details', async() => {
        const id = 'SyKPsFRP_Oc';
        const scope = nock(id, 'rental');
        let info = await ytdl.getBasicInfo(id);
        scope.done();
        assert.ok(info);
        assert.ok(info.videoDetails);
        assert.ok(info.videoDetails.title);
      });
    });
    describe('Not yet broadcasted', () => {
      it('Gets video details', async() => {
        const id = 'VIBFo3Ti5vQ';
        const scope = nock(id, 'live-future');
        let info = await ytdl.getBasicInfo(id);
        scope.done();
        assert.ok(info);
        assert.ok(info.videoDetails);
        assert.ok(info.videoDetails.title);
      });
    });
  });

  describe('With cookie headers', () => {
    const id = '_HSylqgVYQI';
    describe('`x-youtube-identity-token` given', () => {
      it('Does not make extra request to watch.html page', async() => {
        const scope = nock(id, 'regular', {
          watchHtml: false,
          player: false,
        });
        let info = await ytdl.getBasicInfo(id, {
          requestOptions: {
            headers: {
              cookie: 'abc=1',
              'x-youtube-identity-token': '1324',
            },
          },
        });
        scope.done();
        assert.ok(info.formats.length);
      });
    });
    describe('`x-youtube-identity-token` not given', () => {
      it('Retrieves identity-token from watch.html page', async() => {
        const scope = nock(id, 'regular', {
          watchHtml: [true, 200, 'with-cookie'],
          player: false,
        });
        let info = await ytdl.getBasicInfo(id, {
          requestOptions: {
            headers: { cookie: 'abc=1' },
          },
        });
        scope.done();
        assert.ok(info.formats.length);
      });

      describe('Unable to find token', () => {
        it('Returns an error', async() => {
          const scope = nock(id, 'regular', {
            watchJson: false,
            player: false,
          });
          await assert.rejects(ytdl.getBasicInfo(id, {
            requestOptions: {
              headers: { cookie: 'abc=1' },
            },
          }), /unable to find YouTube identity token/);
          scope.done();
        });
      });

      describe('Called from a web browser with cookies in requests', () => {
        it('Tries to get identity-token from watch.html page', async() => {
          const scope = nock(id, 'regular', {
            watchJson: [true, 200, 'reload-now-2'],
            player: false,
          });
          const scope2 = nock(id, 'regular', {
            watchHtml: false,
            player: false,
          });
          let info = await ytdl.getBasicInfo(id, {
            requestOptions: {
              // Assume cookie header is given by the browser.
              headers: {},
              maxRetries: 1,
              backoff: { inc: 0 },
            },
          });
          scope.done();
          scope2.done();
          assert.ok(info.formats.length);
        });
      });
    });
    describe('`x-youtube-identity-token` already in cache', () => {
      it('Does not make extra request to watch.html page', async() => {
        ytdl.cache.cookie.set('abc=1', 'token!');
        const scope = nock(id, 'regular', {
          watchHtml: false,
          player: false,
        });
        let info = await ytdl.getBasicInfo(id, {
          requestOptions: {
            headers: {
              cookie: 'abc=1',
            },
          },
        });
        scope.done();
        assert.ok(info.formats.length);
      });
    });
  });

  describe('When there is a recoverable error', () => {
    describe('Unable to find json field', () => {
      it('Uses backup endpoint', async() => {
        const expected = require('./files/videos/use-backups/expected-info.json');
        const id = 'LuZu9N53Vd0';
        const scope = nock(id, 'use-backups', {
          watchJson: [true, 200, 'reload-now'],
          watchHtml: [true, 200, null, '<html></html>'],
        });
        let info = await ytdl.getBasicInfo(id);
        scope.done();
        assert.strictEqual(info.formats.length, expected.formats.length);
      });
    });

    describe('Unable to parse watch.json page config', () => {
      it('Uses backup watch.html page', async() => {
        const id = 'LuZu9N53Vd0';
        const scope = nock(id, 'use-backups', {
          watchJson: [true, 200, 'bad-config'],
          get_video_info: false,
        });
        let info = await ytdl.getBasicInfo(id);
        scope.done();
        assert.ok(info.html5player);
        assert.ok(info.formats.length);
        assert.ok(info.formats[0].url);
      });
    });

    describe('When watch.json page gives back `{"reload":"now"}`', () => {
      it('Retries the request', async() => {
        const id = '_HSylqgVYQI';
        const scope1 = nock(id, 'regular', {
          watchJson: [true, 200, 'reload-now'],
          get_video_info: false,
          player: false,
        });
        const scope2 = nock(id, 'regular', {
          watchHtml: false,
          player: false,
        });
        let info = await ytdl.getBasicInfo(id, { requestOptions: { maxRetries: 1 } });
        scope1.done();
        scope2.done();
        assert.ok(info.formats.length);
        assert.ok(info.formats[0].url);
      });

      describe('Too many times', () => {
        it('Uses backup endpoint', async() => {
          const id = 'LuZu9N53Vd0';
          const scope = nock(id, 'use-backups', {
            watchJson: [true, 200, 'reload-now'],
            get_video_info: false,
          });
          const scope2 = nock(id, 'use-backups', {
            watchJson: [true, 200, 'reload-now'],
            watchHtml: false,
            get_video_info: false,
          });
          let info = await ytdl.getBasicInfo(id, {
            requestOptions: {
              maxRetries: 1,
              backoff: { inc: 0 },
            },
          });
          scope.done();
          scope2.done();
          assert.ok(info.html5player);
          assert.ok(info.formats.length);
        });
      });
    });

    describe('When watch.json page gives back an empty response', () => {
      it('Uses backup endpoint', async() => {
        const id = 'LuZu9N53Vd0';
        const scope1 = nock(id, 'use-backups', {
          watchJson: [true, 200, 'empty'],
          get_video_info: false,
        });
        let info = await ytdl.getBasicInfo(id, { requestOptions: { maxRetries: 0 } });
        scope1.done();
        assert.ok(info.formats.length);
        assert.ok(info.formats[0].url);
      });
    });

    describe('When an endpoint gives back a 500 server error', () => {
      it('Retries the request', async() => {
        const id = '_HSylqgVYQI';
        const scope1 = nock(id, 'regular', {
          watchJson: [true, 502],
          player: false,
        });
        const scope2 = nock(id, 'regular', {
          watchJson: [true, 502],
          watchHtml: false,
          player: false,
        });
        let info = await ytdl.getBasicInfo(id, { requestOptions: { maxRetries: 1 } });
        scope1.done();
        scope2.done();
        assert.ok(info.formats.length);
        assert.ok(info.formats[0].url);
      });

      describe('Too many times', () => {
        it('Uses the next endpoint as backup', async() => {
          const id = 'LuZu9N53Vd0';
          const scope = nock(id, 'use-backups', {
            watchJson: [true, 502],
            get_video_info: false,
          });
          let info = await ytdl.getBasicInfo(id);
          scope.done();
          assert.ok(info.html5player);
          assert.ok(info.formats.length);
          assert.ok(info.formats[0].url);
          assert.ok(!info.videoDetails.age_restricted);
        });
      });
    });
  });

  describe('When there is an unrecoverable error', () => {
    describe('With a private video', () => {
      it('Fails gracefully', async() => {
        const id = 'z2jeHsa0UG0';
        const scope = nock(id, 'private');
        await assert.rejects(ytdl.getBasicInfo(id, { requestOptions: { maxRetries: 1 } }), /private video/);
        scope.done();
      });
    });

    describe('From a non-existant video', () => {
      const id = '99999999999';
      it('Should give an error', async() => {
        const scope = nock(id, 'non-existent');
        await assert.rejects(ytdl.getBasicInfo(id), /Video unavailable/);
        scope.done();
      });
    });

    describe('With a bad video ID', () => {
      it('Returns an error', () => {
        const id = 'bad';
        assert.throws(() => {
          ytdl.getBasicInfo(id);
        }, /No video id found: bad/);
      });
    });

    describe('No endpoint works', () => {
      it('Fails gracefully', async() => {
        const id = 'LuZu9N53Vd0';
        const scope = nock(id, 'use-backups', {
          watchJson: [true, 500],
          watchHtml: [true, 500],
          get_video_info: [true, 500],
        });
        await assert.rejects(ytdl.getBasicInfo(id, {
          requestOptions: { maxRetries: 0 },
        }), /Status code: 500/);
        scope.done();
      });
    });
  });
});
