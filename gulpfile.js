/*
  Cribbed from https://github.com/lazymozek/gulp-with-tailwindcss

  Usage:
  1. npm install //To install all dev dependencies of package
  2. npm run dev //To start development and server for live preview
  3. npm run prod //To generate minifed files for live server
*/

const { src, dest, task, watch, series, parallel } = require('gulp');
const browserSync = require('browser-sync').create();
const sass = require('gulp-sass'); //For Compiling SASS files
const postcss = require('gulp-postcss'); //For Compiling tailwind utilities with tailwind config
const logSymbols = require('log-symbols'); //For Symbolic Console logs :) :P


//Load previews on browser on dev
function livePreview(done){
  browserSync.init({
    port: 3000,
    proxy: "https://maptiler-integration.test/",
    notify: false,
    open: false
  });
  done();
}

// Triggers Browser reload
function previewReload(done){
  console.log("\n\t" + logSymbols.info,"Reloading browser preview…\n");
  browserSync.reload();
  done();
}

//Development Tasks
function devStyles(){
  return src('src/scss/main.scss').pipe(sass().on('error', sass.logError))
    .pipe(postcss([
      require('autoprefixer'),
    ]))
    .pipe(dest('dist'))
    .pipe(browserSync.stream({match: '**/*.css'}));
}

function watchFiles(){
  watch('index.html',series(previewReload));
  watch(['js/**/*.js'],series(previewReload));
  watch(['src/scss/main.scss'],series(devStyles));
  console.log("\n\t" + logSymbols.info,"Watching for changes…\n");
}

exports.default = series(
  devStyles,
  livePreview,
  watchFiles
);
