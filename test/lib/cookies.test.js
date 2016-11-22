'use strict';

/**
 * Module dependencies.
 */

const Cookies = require('../cookies');
const assert = require('power-assert');

describe('test/lib/cookies.test.js', () => {
  it('should encrypt error when keys not present', () => {
    const cookies = Cookies({}, { keys: null });
    try {
      cookies.set('foo', 'bar', { encrypt: true });
      throw new Error('should not exec');
    } catch (err) {
      assert(err.message === '.keys required for encrypt/sign cookies');
    }
  });

  it('should not thrown when keys not present and do not use encrypt or sign', () => {
    const cookies = Cookies({}, { keys: null });
    cookies.set('foo', 'bar', { encrypt: false, signed: false });
  });

  it('should encrypt ok', () => {
    const cookies = Cookies();
    cookies.set('foo', 'bar', { encrypt: true });
    const cookie = cookies.ctx.response.headers['set-cookie'][0];
    cookies.ctx.request.headers.cookie = cookie;
    const value = cookies.get('foo', { encrypt: true });
    assert(value, 'bar');
    assert(cookie.indexOf('bar') === -1);
  });

  it('should encrypt failed return undefined', () => {
    const cookies = Cookies();
    cookies.set('foo', 'bar', { encrypt: true });
    const cookie = cookies.ctx.response.headers['set-cookie'][0];
    const newCookies = Cookies({
      headers: { cookie },
    }, { keys: [ 'another key' ] });
    const value = newCookies.get('foo', { encrypt: true });
    assert(value === undefined);
  });

  it('should disable signed when encrypt enable', () => {
    const cookies = Cookies();
    cookies.set('foo', 'bar', { encrypt: true, signed: true });
    const cookie = cookies.ctx.response.headers['set-cookie'].join(';');
    cookies.ctx.request.headers.cookie = cookie;
    const value = cookies.get('foo', { encrypt: true });
    assert(value, 'bar');
    assert(cookie.indexOf('bar') === -1);
    assert(cookie.indexOf('sig') === -1);
  });

  it('should work with secure ok', () => {
    const cookies = Cookies({}, {
      secure: true,
    });
    cookies.set('foo', 'bar', { encrypt: true });
    const cookie = cookies.ctx.response.headers['set-cookie'][0];
    assert(cookie.indexOf('secure') > 0);
  });

  it('should signed work fine', () => {
    const cookies = Cookies();
    cookies.set('foo', 'bar', { signed: true });
    const cookie = cookies.ctx.response.headers['set-cookie'].join(';');
    assert(cookie.indexOf('foo=bar') >= 0);
    assert(cookie.indexOf('foo.sig=') >= 0);
    cookies.ctx.request.headers.cookie = cookie;
    let value = cookies.get('foo', { signed: true });
    assert(value === 'bar');
    cookies.ctx.request.headers.cookie = cookie.replace('foo=bar', 'foo=bar1');
    value = cookies.get('foo', { signed: true });
    assert(!value);
    value = cookies.get('foo', { signed: false });
    assert(value === 'bar1');
  });

  it('should return undefined when header.cookie not exists', () => {
    const cookies = Cookies();
    assert(cookies.get('hello') === undefined);
  });

  it('should return undefined when cookie not exists', () => {
    const cookies = Cookies({
      headers: { cookie: 'foo=bar' },
    });
    assert(cookies.get('hello') === undefined);
  });

  it('should return undefined when signed and name.sig not exists', () => {
    const cookies = Cookies({
      headers: { cookie: 'foo=bar;' },
    });
    assert(cookies.get('foo', { signed: true }) === undefined);
    assert(cookies.get('foo', { signed: false }) === 'bar');
    assert(cookies.get('foo') === undefined);
  });

  it('should set .sig to null if not match', () => {
    const cookies = Cookies({
      headers: { cookie: 'foo=bar;foo.sig=bar.sig;' },
    });
    assert(cookies.get('foo', { signed: true }) === undefined);
    assert(cookies.ctx.response.headers['set-cookie'][0] === 'foo.sig=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly');
  });

  it('should update .sig if not match the first key', () => {
    const cookies = Cookies({
      headers: { cookie: 'foo=bar;foo.sig=bar.sig;' },
    }, { keys: [ 'hello', 'world' ] });
    cookies.set('foo', 'bar');
    const cookie = cookies.ctx.response.headers['set-cookie'].join(';');

    const newCookies = Cookies({
      headers: { cookie },
    }, { keys: [ 'hi', 'hello' ] });

    assert(newCookies.get('foo', { signed: true }) === 'bar');
    const newSign = newCookies.keys.sign('foo=bar');
    assert(newCookies.ctx.response.headers['set-cookie'][0].startsWith(`foo.sig=${newSign}`));
  });

  it('should not overwrite default', () => {
    const cookies = Cookies();
    cookies.set('foo', 'bar');
    cookies.set('foo', 'hello');
    assert(cookies.ctx.response.headers['set-cookie'].join(';').match(/foo=bar/));
  });

  it('should overwrite when opts.overwrite = true', () => {
    const cookies = Cookies();
    cookies.set('foo', 'bar');
    cookies.set('foo', 'hello', { overwrite: true });
    assert(cookies.ctx.response.headers['set-cookie'].join(';').match(/foo=hello/));
  });

  it('should remove signed cookie ok', () => {
    const cookies = Cookies();
    cookies.set('foo', null, { signed: true });
    assert(cookies.ctx.response.headers['set-cookie'].join(';').match(/foo=; path=\/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly/));
    assert(cookies.ctx.response.headers['set-cookie'].join(';').match(/foo\.sig=; path=\/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly/));
  });

  it('should remove encrypt cookie ok', () => {
    const cookies = Cookies();
    cookies.set('foo', null, { encrypt: true });
    assert(cookies.ctx.response.headers['set-cookie'].join(';').match(/foo=; path=\/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly/));
  });

  it('should add secure when ctx.secure = true', () => {
    const cookies = Cookies({}, { secure: true });
    cookies.set('foo', 'bar');
    assert(cookies.ctx.response.headers['set-cookie'].join(';').match(/secure;/));
  });

  it('should not add secure when ctx.secure = true but opt.secure = false', () => {
    const cookies = Cookies({}, { secure: true });
    cookies.set('foo', 'bar', { secure: false });
    assert(!cookies.ctx.response.headers['set-cookie'].join(';').match(/secure;/));
  });

  it('should throw when ctx.secure = false but opt.secure = true', () => {
    const cookies = Cookies({}, { secure: false });
    try {
      cookies.set('foo', 'bar', { secure: true });
      throw new Error('should not exec');
    } catch (err) {
      assert(err.message === 'Cannot send secure cookie over unencrypted connection');
    }
  });
});