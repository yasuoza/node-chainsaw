var Chainsaw = require('../../chainsaw/');

describe('Chainsaw', function () {
  it('should get parameter and set parameter', function (done) {

     var to = setTimeout(function () {
       throw new error('builder never fired');
     }, 1000);

     var ch = Chainsaw(function (saw) {
       clearTimeout(to);
       var num = 0;

       this.get = function (cb) {
         cb(num);
         saw.next();
       };

       this.set = function (n) {
         num = n;
         saw.next();
       };

       var ti = setTimeout(function () {
         throw new Error('end event not emitted');
       }, 50);

       saw.on('end', function () {
         clearTimeout(ti);
         times.should.equal(3);
         done();
       });
     });

     var times = 0;
     ch
       .get(function (x) {
         x.should.equal(0);
         times ++;
       })
       .set(10)
       .get(function (x) {
         x.should.equal(10);
         times ++;
       })
       .set(20)
       .get(function (x) {
         x.should.equal(20);
         times ++;
       })
     ;
  });

  it('should nest chain', function (done){
    var ch = (function () {
      var vars = {};
      return new Chainsaw(function (saw) {
        this.do = function (cb) {
          saw.nest(cb, vars);
        };
      });
    }());

    var order = [];
    var to = setTimeout(function () {
      throw new Error('Did not get to the end');
    }, 50);

    ch
      .do(function (vars) {
        vars.x = 'y';
        order.push(1);

        this
            .do(function (vs) {
              order.push(2);
              vs.x = 'x';
            })
            .do(function (vs) {
              order.push(3);
              vs.z = 'z';
            })
          ;
      })
      .do(function (vars) {
        vars.y = 'y';
        order.push(4);
      })
      .do(function (vars) {
        order.should.eql([1, 2, 3, 4]);
        vars.should.eql({ x : 'x', y : 'y', z : 'z' });
        clearTimeout(to);
        done();
      })
    ;
  });

  it('should wait after nest', function (done) {
    var ch = (function () {
      var vars = {};
      return new Chainsaw(function (saw) {
        this.do = function (cb) {
          saw.nest(cb, vars);
        };

        this.wait = function (n) {
          setTimeout(function () {
            saw.next();
          }, n);
        };
      });
    })();

    var order = [];
    var to = setTimeout(function () {
      throw new Error ('Did not get to the error');
    }, 1000);

    var times = {};

    ch
      .do(function (vars) {
        vars.x = 'y';
        order.push(1);

        this
            .do(function (vs) {
              order.push(2);
              vs.x = 'x';
              times.x = Date.now();
            })
            .wait(50)
            .do(function (vs) {
              order.push(3);
              vs.z = 'z';

              times.z = Date.now();
              var dt = times.z - times.x;
              dt.should.be.within(50, 75);
            })
        ;
      })
      .do(function (vars) {
        vars.y = 'y';
        order.push(4);

        times.y = Date.now();
      })
      .wait(100)
      .do(function (vars) {
        order.should.eql([1, 2, 3, 4]);
        vars.should.eql({ x : 'x', y : 'y', z : 'z' });
        clearTimeout(to);

        times.end = Date.now();
        var dt = times.end - times.y;
        dt.should.be.within(100, 125);
        done();
      })
     ;
  });

  it('should nest next chain', function (done) {
    var ch = (function () {
      var vars = {};
      return new Chainsaw(function (saw) {
        this.do = function (cb) {
          saw.nest(false, function () {
            var args = [].slice.call(arguments);
            args.push(saw.next);
            cb.apply(this, args)
          }, vars);
        };
      });
    }());

    var order = [];
    var to = setTimeout(function () {
      throw new Error ('Did not get to the error');
    }, 500);

    var times = [];

    ch
      .do(function (vars, next_) {
        vars.x = 'y';
        order.push(1);

        this
            .do(function (vs, next) {
              order.push(2);
              vs.x = 'x';
              setTimeout(next, 30)
            })
            .do(function (vs, next) {
              order.push(3);
              vs.z = 'z';
              setTimeout(next, 10);
            })
            .do(function () {
              setTimeout(next_, 20);
            })
        ;
       })
       .do(function (vars, next) {
         vars.y = 'y';
         order.push(4);
         setTimeout(next, 5);
       })
       .do(function (vars) {
         order.should.eql([1, 2, 3, 4]);
         vars.should.eql({ x : 'x', y : 'y', z : 'z' });
         done();
       })
    ;
  });

  it('should be defined its handler via builder', function (done) {
    var cx = new Chainsaw(function (saw) {
      this.x = function () {};
    });
    cx.x.should.ok;

    var cy = new Chainsaw(function (saw) {
      return {y: function () {}};
    });
    cy.y.should.ok;

    var cz = new Chainsaw(function (saw) {
      return {z: function (cb) { saw.nest(cb) } };
    });
    cz.z.should.ok;

    var to = setTimeout(function (saw) {
      throw new Error('Nested z did not run');
    }, 50);

    cz.z(function () {
      clearTimeout(to);
      this.z.should.ok;
      done();
    });
  });

  it('should attribute chain', function (done) {
    var to = setTimeout(function () {
      throw new Error('attr chain did not finish');
    }, 50);

    var xy = [];
    var ch = Chainsaw(function (saw) {
      this.h = {
        x: function () {
          xy.push('x');
          saw.next();
        },
        y: function () {
          xy.push('y');
          xy.should.eql(['x', 'y']);
          clearTimeout(to);
        }
      };
    });
    ch.h.should.ok;
    ch.h.x.should.ok;
    ch.h.y.should.ok;

    ch.h.x().h.y();
    done();
  });

  it('should be enable to down its chain', function (done) {
    var error = null,
        ch = Chainsaw(function (saw) {
          this.raise = function (err) {
            error = err;
            saw.down('catch');
          };

          this.do = function (cb) {
            cb.call(this);
          };

          this.catch = function (cb) {
            if (error) {
              saw.nest(cb, error);
              error = null;
            }
            else saw.next();
          };
        });

    var to = setTimeout(function () {
      throw new Error('.do after .catch did not fire');
    }, 50);

    ch
      .do(function () {
        this.raise('pow!');
      })
      .do(function () {
        throw new Error('raise did not skip over this do block');
      })
      .catch(function (err) {
        err.should.equal('pow!');
      })
      .do(function () {
        clearTimeout(to);
        done();
      })
    ;
  });

  it('should be enable to stop its chain', function (done) {
    var error = null,
        ch = Chainsaw(function (saw) {
          this.raise = function (err) {
            error = err;
            saw.down('catch');
          };

          this.do = function (cb) {
            cb.call(this);
          };

          this.catch = function (cb) {
            if (error) {
              cb.call(this, error);
              error = null;
            }
            else saw.next();
          };
        });

    ch
      .do(function () {
        this.raise('pow!');
      })
      .do(function () {
        throw new Error('raise did not skip over this do block');
      })
      .catch(function (err) {
        err.should.equal('pow!');
        setTimeout(function () { done(); }, 5);
      })
      .do(function () {
        throw new Error('stop did not stop previous block');
      })
    ;
  });

  it('should trap chain', function (done) {
    var error = null;
    var ch = Chainsaw(function (saw) {
      var pars = 0;
      var stack = [];
      var i = 0;

      this.par = function (cb) {
        pars ++;
        var j = i ++;
        cb.call(function () {
          pars--;
          stack[j] = [].slice.call(arguments);
          saw.down('result');
        });
        saw.next();
      };

      this.join = function (cb) {
        saw.trap('result', function () {
          if (pars == 0) {
            cb.apply(this, stack);
            saw.next();
          }
        });
      };

      this.do = function (cb) {
        cb.call(this);
      };
    });

      var to = setTimeout(function () {
        throw new Error('.do() after .join() did not fire');
      }, 100);
      var tj = setTimeout(function () {
        throw new Error('.join never fired');
      }, 100);

      var joined = false;
      ch
        .par(function () {
          setTimeout(this.bind(null, 1), 50);
        })
        .par(function () {
          setTimeout(this.bind(null, 2), 25);
        })
        .join(function (x, y) {
          x[0].should.equal(1);
          y[0].should.equal(2);
          clearTimeout(tj);
          joined = true;
        })
        .do(function () {
          clearTimeout(to);
          joined.should.true;
          done();
        })
      ;
    });

  it('should jump chain', function (done) {
    var to = setTimeout(function () {
      throw new Error('builder not fired');
    }, 50);

    var xs = [4, 5, 6, -4, 8, 9, -1, 8];
    var xs_ = [];

    var ch = Chainsaw(function (saw) {
      this.x = function (i) {
        xs_.push(i);
        saw.next();
      };

      this.y = function (step) {
        var x = xs.shift();
        if (x > 0) saw.jump(step);
        else saw.next();
      };

      saw.on('end', function () {
        clearTimeout(to);
        xs.should.eql([8]);
        xs_.should.eql([1, 1, 1, 1, 2, 3, 2, 3, 2, 3]);
        done();
      });
    });

    ch
      .x(1)
      .y(0)
      .x(2)
      .x(3)
      .y(2)
    ;
  });
});
