/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const gulp        = require('gulp');
const noop        = require("gulp-noop");
const babel       = require('gulp-babel');
const uglify      = require('gulp-uglify-es').default;
const del         = require('del');
const jshint      = require('gulp-jshint');
const mocha       = require('gulp-mocha');
const sourcemaps  = require('gulp-sourcemaps');
const gulpif      = require('gulp-if');
const htmlmin     = require('gulp-htmlmin');
const cleancss    = require('gulp-clean-css');
const less        = require('gulp-less');
const manifest    = require('gulp-manifest');
const yaml        = require('gulp-yaml');

const minified = process.env.NODE_ENV !== 'development';
const sourcemapEnabled = !minified;
const babelOptions = {
  presets: [
    [
      'env',
      {
        targets: {
          node: 'current'
        }
      }
    ]
  ],
  plugins: ['add-module-exports']
};

gulp.task('lint', () => {
  return gulp.src([
    './tests/**/*.js',
    './src/**/*.js'
  ])
  .pipe(jshint())
  .pipe(jshint.reporter('jshint-stylish'))
  .pipe(jshint.reporter('fail'));
});

gulp.task('clean', () => {
  return del([
    'dist/*',
    './dist',
    '!node_modules/**/*',
    './*.tgz',
  ]);
});

gulp.task('cleanTestJs', () => {
  return del([
    'dist/**/*.test.js',
  ]);
});

gulp.task('i18n', () => {
  return gulp.src([
      './src/locales/**/*.{yaml,yml}'
    ])
    .pipe(yaml({ safe: true }))
    .pipe(gulp.dest('./dist/locales'));
});

gulp.task('assets', ['i18n'], () => {
  return gulp.src([
      './src/**/*.{less,ico,png,jpg,json,yaml,yml}',
      '!./src/locales/**/*.{yaml,yml}'
    ])
    .pipe(gulp.dest('./dist'));
});

gulp.task('js', ['assets'], () => {
  return gulp.src('./src/**/*.js')
    .pipe(gulpif(sourcemapEnabled, sourcemaps.init(), noop()))
    .pipe(babel({
      minified: minified,
      compact: minified,
      presets: babelOptions.presets,
      plugins: babelOptions.plugins,
    }))
    .pipe(gulpif(!sourcemapEnabled, uglify({
      mangle: minified,
      output: {
        comments: 'some',
      },
      compress: {
        dead_code: true,
        drop_debugger: true,
        properties: true,
        unused: true,
        toplevel: true,
        if_return: true,
        drop_console: true,
        conditionals: true,
        unsafe_math: true,
        unsafe: true
      },
    }), noop()))
    .pipe(gulpif(sourcemapEnabled, sourcemaps.write(), noop()))
    .pipe(gulp.dest('./dist'));
});

gulp.task('less', () => {
  return gulp.src('./src/**/*.less')
    .pipe(gulpif(sourcemapEnabled, sourcemaps.init(), noop()))
    .pipe(less())
    .pipe(cleancss({compatibility: 'ie8'}))
    .pipe(gulpif(sourcemapEnabled, sourcemaps.write(), noop()))
    .pipe(gulp.dest('./dist'));
});

gulp.task('html', () => {
  return gulp.src([
      './src/**/*.html',
      '!./src/nodes/*/node_modules/**/*.html',
    ])
    .pipe(htmlmin({
      collapseWhitespace: true,
      conservativeCollapse: true,
      minifyJS: true, minifyCSS: true,
      removeComments: true
    }))
    .pipe(gulp.dest('./dist'));
});

gulp.task('build', ['lint', 'js', 'less', 'html', 'assets']);

gulp.task('testAssets', () => {
  return gulp.src('./tests/**/*.{css,less,ico,png,html,json,yaml,yml}')
  .pipe(gulp.dest('./dist'));
});

gulp.task('testJs', ['cleanTestJs', 'build'], () => {
  return gulp.src('./tests/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: babelOptions.presets,
      plugins: babelOptions.plugins,
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('test', ['testJs', 'testAssets'], () => {
  return gulp.src([
    './dist/**/*.test.js',
  ], {read: false})
  .pipe(mocha({
    require: ['source-map-support/register'],
    reporter: 'spec'
  }))
  .once('error', () => process.exit(1))
  .once('end', () => process.exit())
});

gulp.task('default', ['build']);
