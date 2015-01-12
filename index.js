var bower = require('bower');
var fs = require('fs');
var gutil = require('gulp-util');
var path = require('path');
var through = require('through2');
var walk = require('walk');

var toString = {}.toString;

module.exports = function (opts, cmdArguments) {

	var stream = through.obj(function(file, enc, callback) {
		this.push(file);
		callback();
	});

	if (toString.call(opts) === '[object String]') {
		opts = {
			directory: opts
		};
	}

	opts = opts || {};
	opts.cwd = opts.cwd || process.cwd();

	if (!opts.directory) {
		var bowerrc = path.join(opts.cwd, '.bowerrc');
		if (fs.existsSync(bowerrc)) {
			var bower_config = JSON.parse(fs.readFileSync(bowerrc));
			opts.directory = bower_config.directory;
		}
		opts.directory = opts.directory || path.join(opts.cwd, 'bower_components');
	}

	var dir = opts.directory;
	gutil.log("Using cwd: ", opts.cwd);
	gutil.log("Using bower dir: ", dir);

	var cmd = opts.cmd || 'install';
	delete(opts.cmd);

	if (toString.call(cmdArguments) !== '[object Array]') {
		cmdArguments = [];
	}
	if (toString.call(cmdArguments[0]) !== '[object Array]') {
		cmdArguments[0] = [];
	}
	cmdArguments[1] = cmdArguments[1] || {};
	cmdArguments[2] = opts;

	bower.commands[cmd].apply(bower.commands, cmdArguments)
		.on('log', function(result) {
			gutil.log(['bower', gutil.colors.cyan(result.id), result.message].join(' '));
		})
		.on('error', function(error) {
			stream.emit('error', new gutil.PluginError('gulp-bower', error));
			stream.end();
		})
		.on('end', function() {
			var baseDir = path.join(opts.cwd, dir);
			var walker = walk.walk(baseDir);
			walker.on("errors", function(root, stats, next) {
				stream.emit('error', new gutil.PluginError('gulp-bower', stats.error));
				next();
			});
			walker.on("directory", function(root, stats, next) {
				next();
			});
			walker.on("file", function(root, stats, next) {
				var filePath = path.resolve(root, stats.name);

				fs.readFile(filePath, function(error, data) {
					if (error)
						stream.emit('error', new gutil.PluginError('gulp-bower', error));
					else
						stream.write(new gutil.File({
							path: path.relative(baseDir, filePath),
							contents: data
						}));

					next();
				});
			});
			walker.on("end", function() {
				stream.end();
				stream.emit("end");
			});
		});

	return stream;
};
