/* Ace syntax-highlighting code editor extension for wikiEditor */
/*global require, ace, confirm */
( function ( $, mw ) {
	$.wikiEditor.modules.codeEditor = {
		/**
		 * Core Requirements
		 */
		'req': [ 'codeEditor' ],
		/**
		 *  Compatability map
		 */
		browsers: {
			msie: [['>=', 8]]
		},
		/**
		 * Configuration
		 */
		cfg: {
			//
		},
		/**
		 * API accessible functions
		 */
		api: {
			//
		},
		/**
		 * Event handlers
		 */
		evt: {
			//
		},
		/**
		 * Internally used functions
		 */
		fn: {
		}

	};

	$.wikiEditor.extensions.codeEditor = function ( context ) {
		var saveAndExtend;

		/*
		 * Event Handlers
		 *
		 * These act as filters returning false if the event should be ignored or returning true if it should be passed
		 * on to all modules. This is also where we can attach some extra information to the events.
		 */
		context.evt = $.extend( context.evt, {
			/**
			 * Filters change events, which occur when the user interacts with the contents of the iframe. The goal of this
			 * function is to both classify the scope of changes as 'division' or 'character' and to prevent further
			 * processing of events which did not actually change the content of the iframe.
			 */
			'keydown': $.noop,
			'change': $.noop,
			'delayedChange': $.noop,
			'cut': $.noop,
			'paste': $.noop,
			'ready': $.noop,
			'codeEditorSubmit': function () {
				context.evt.codeEditorSync();
				var i,
					hasError = false,
					annotations = context.codeEditor.getSession().getAnnotations();
				for ( i = 0; i < annotations.length; i++ ) {
					if ( annotations[i].type === 'error' ) {
						hasError = true;
						break;
					}
				}
				if ( hasError ) {
					return confirm( mw.msg( 'codeeditor-save-with-errors' ) );
				}
			},
			'codeEditorSync': function () {
				context.$textarea.val( context.$textarea.textSelection( 'getContents' ) );

			}
		} );

		context.codeEditorActive = mw.user.options.get( 'usecodeeditor' ) !== '0';

		/**
		 * Internally used functions
		 */
		context.fn = $.extend( context.fn, {
			'codeEditorToolbarIcon': function () {
				// When loaded as a gadget, one may need to override the wiki's own assets path.
				var iconPath = mw.config.get( 'wgCodeEditorAssetsPath', mw.config.get( 'wgExtensionAssetsPath' ) ) + '/CodeEditor/images/';
				return iconPath + ( context.codeEditorActive ? 'code-selected.png' : 'code.png' );
			},
			'setupCodeEditorToolbar': function () {
				// Drop out some formatting that isn't relevant on these pages...
				context.api.removeFromToolbar( context, {
					'section': 'main',
					'group': 'format',
					'tool': 'bold'
				} );
				context.api.removeFromToolbar( context, {
					'section': 'main',
					'group': 'format',
					'tool': 'italic'
				} );
				var callback = function ( context ) {
					context.codeEditorActive = !context.codeEditorActive;

					context.fn.setCodeEditorPreference( context.codeEditorActive );
					context.fn.toggleCodeEditorToolbar();

					if ( context.codeEditorActive ) {
						// set it back up!
						context.fn.setupCodeEditor();
					} else {
						context.fn.disableCodeEditor();
					}
				};
				context.api.addToToolbar( context, {
					'section': 'main',
					'group': 'format',
					'tools': {
						'codeEditor': {
							'labelMsg': 'codeeditor-toolbar-toggle',
							'type': 'button',
							'icon': context.fn.codeEditorToolbarIcon(),
							'action': {
								'type': 'callback',
								'execute': callback
							}
						}
					}
				} );
			},
			'toggleCodeEditorToolbar': function () {
				var target, $img;

				target = 'img.tool[rel=codeEditor]';
				$img = context.modules.toolbar.$toolbar.find( target );
				$img.attr( 'src', context.fn.codeEditorToolbarIcon() );
			},
			'setCodeEditorPreference': function ( prefValue ) {
				var api = new mw.Api();
				api.postWithToken( 'options', {
					action: 'options',
					optionname: 'usecodeeditor',
					optionvalue: prefValue ? 1 : 0
				} ).fail( function ( code, result ) {
					mw.log.warn( 'Failed to set code editor preference: ' + code + '\n' + result.error );
				} );
			},
			/**
			 * Sets up the iframe in place of the textarea to allow more advanced operations
			 */
			'setupCodeEditor': function () {
				var box, lang, basePath, container, editdiv, session, resize, AceLangMode;

				box = context.$textarea;
				lang = mw.config.get( 'wgCodeEditorCurrentLanguage' );
				basePath = mw.config.get( 'wgExtensionAssetsPath', '' );
				if ( basePath.substring( 0, 2 ) === '//' ) {
					// ACE uses web workers, which have importScripts, which don't like relative links.
					// This is a problem only when the assets are on another server, so this rewrite should suffice
					// Protocol relative
					basePath = window.location.protocol + basePath;
				}
				ace.config.set( 'basePath', basePath + '/CodeEditor/modules/ace' );

				if ( lang ) {
					// Ace doesn't like replacing a textarea directly.
					// We'll stub this out to sit on top of it...
					// line-height is needed to compensate for oddity in WikiEditor extension, which zeroes the line-height on a parent container
					container = context.$codeEditorContainer = $( '<div style="position: relative"><div class="editor" style="line-height: 1.5em; top: 0; left: 0; right: 0; bottom: 0; position: absolute;"></div></div>' ).insertAfter( box );
					editdiv = container.find( '.editor' );

					box.css( 'display', 'none' );
					container.width( box.width() )
						.height( box.height() );

					// Non-lazy loaded dependencies: Enable code completion
					ace.require( 'ace/ext/language_tools' );

					// Load the editor now
					context.codeEditor = ace.edit( editdiv[0] );
					context.codeEditor.getSession().setValue( box.val() );

					// Disable some annoying commands
					context.codeEditor.commands.removeCommand( 'replace' );          // ctrl+R
					context.codeEditor.commands.removeCommand( 'transposeletters' ); // ctrl+T
					context.codeEditor.commands.removeCommand( 'gotoline' );         // ctrl+L

					context.codeEditor.setReadOnly( box.prop( 'readonly' ) );

					// The options to enable
					context.codeEditor.setOptions( {
						enableBasicAutocompletion: true,
						enableSnippets: true
					} );

					// fakeout for bug 29328
					context.$iframe = [
						{
							contentWindow: {
								focus: function () {
									context.codeEditor.focus();
								}
							}
						}
					];
					box.closest( 'form' ).submit( context.evt.codeEditorSubmit );
					session = context.codeEditor.getSession();

					// Use proper tabs
					session.setUseSoftTabs( false );

					// Bug 47235: Update text field for LivePreview
					if ( mw.hook ) {
						mw.hook( 'codeEditor.configure' ).fire( session );
					}
					// Old, deprecated style for backwards compat
					// Do this even if mw.hook exists, because the caller wasn't
					// updated right away to actually use the new style.
					$( mw ).bind( 'LivePreviewPrepare', context.evt.codeEditorSubmit );

					ace.config.loadModule( 'ace/mode/' + lang, function () {
						AceLangMode = require( 'ace/mode/' + lang ).Mode;
						session.setMode( new AceLangMode() );
					} );

					// Force the box to resize horizontally to match in future :D
					resize = function () {
						container.width( box.width() );
					};
					$( window ).resize( resize );
					// Use jquery.ui.resizable so user can make the box taller too
					container.resizable( {
						handles: 's',
						minHeight: box.height(),
						resize: function () {
							context.codeEditor.resize();
						}
					} );

					context.fn.setupStatusBar();

					// Let modules know we're ready to start working with the content
					context.fn.trigger( 'ready' );
				}
			},

			/**
			 *  Turn off the code editor view and return to the plain textarea.
			 * May be needed by some folks with funky browsers, or just to compare.
			 */
			'disableCodeEditor': function () {
				// Kills it!
				context.$textarea.closest( 'form' ).unbind( 'submit', context.evt.codeEditorSubmit );
				$( mw ).unbind( 'LivePreviewPrepare', context.evt.codeEditorSubmit ); // deprecated

				// Save contents
				context.$textarea.val( context.fn.getContents() );

				// @todo fetch cursor, scroll position

				// Drop the fancy editor widget...
				context.fn.removeStatusBar();
				context.$codeEditorContainer.remove();
				context.$codeEditorContainer = undefined;
				context.$iframe = undefined;
				context.codeEditor = undefined;

				// Restore textarea
				context.$textarea.show();

				// @todo restore cursor, scroll position
			},

			/**
			 * Start monitoring the fragment of the current window for hash change
			 * events. If the hash is already set, handle it as a new event.
			 */
			'codeEditorMonitorFragment': function () {
				function onHashChange() {
					var regexp, result, line;

					regexp = /#mw-ce-l(\d+)/;
					result = regexp.exec( window.location.hash );

					if ( result === null ) {
						return;
					}

					// Line numbers in CodeEditor are zero-based
					line = parseInt( result[1], 10 );
					context.codeEditor.navigateTo( line - 1, 0 );
					// Scroll up a bit to give some context
					context.codeEditor.scrollToRow( line - 4 );
				}

				onHashChange();
				$( window ).on( 'hashchange', onHashChange );
			},
			/**
			 * This creates a Statusbar, that allows you to see a count of the
			 * errors, warnings and the warning of the current line, as well as
			 * the position of the cursor.
			 */
			'setupStatusBar': function () {
				var shouldUpdateAnnotations,
					shouldUpdateSelection,
					shouldUpdateLineInfo,
					nextAnnotation,
					delayedUpdate,
					editor = context.codeEditor,
					lang = require( 'ace/lib/lang' ),
					$errors = $( '<span class="codeEditor-status-worker-cell ace_gutter-cell ace_error">0</span>' ),
					$warnings = $( '<span class="codeEditor-status-worker-cell ace_gutter-cell ace_warning">0</span>' ),
					$infos = $( '<span class="codeEditor-status-worker-cell ace_gutter-cell ace_info">0</span>' ),
					$message = $( '<div>' ).addClass( 'codeEditor-status-message' ),
					$lineAndMode = $( '<div>' ).addClass( 'codeEditor-status-line' ),
					$workerStatus = $( '<div>' )
						.addClass( 'codeEditor-status-worker' )
						.append( $errors )
						.append( $warnings )
						.append( $infos );

				context.$statusBar = $( '<div>' )
					.addClass( 'codeEditor-status' )
					.append( $workerStatus )
					.append( $message )
					.append( $lineAndMode );

				/* Help function to concatenate strings with different separators */
				function addToStatus( status, str, separator ) {
					if ( str ) {
						status.push( str, separator || '|' );
					}
				}

				/**
				 * Update all the information in the status bar
				 */
				function updateStatusBar() {
					var i, c, r,
						status,
						annotation,
						errors = 0,
						warnings = 0,
						infos = 0,
						distance,
						shortestDistance = Infinity,
						closestAnnotation,
						currentLine = editor.selection.lead.row,
						annotations = context.codeEditor.getSession().getAnnotations();

					// Reset the next annotation
					nextAnnotation = null;

					for ( i = 0; i < annotations.length; i++ ) {
						annotation = annotations[i];
						distance = Math.abs( currentLine - annotation.row );

						if ( distance < shortestDistance ) {
							shortestDistance = distance;
							closestAnnotation = annotation;
						}
						if ( nextAnnotation === null && annotation.row > currentLine ) {
							nextAnnotation = annotation;
						}

						switch ( annotations[i].type ) {
							case 'error':
								errors++;
								break;
							case 'warning':
								warnings++;
								break;
							case 'info':
								infos++;
								break;
						}
					}
					// Wrap around to the beginning for nextAnnotation
					if ( nextAnnotation === null && annotations.length > 0 ) {
						nextAnnotation = annotations[0];
					}
					// Update the annotation counts
					if ( shouldUpdateAnnotations ) {
						$errors.text( errors );
						$warnings.text( warnings );
						$infos.text( infos );
					}

					// Show the message of the current line, if we have not already done so
					if ( closestAnnotation &&
							currentLine === closestAnnotation.row &&
							closestAnnotation !== $message.data( 'annotation' ) ) {
						$message.data( 'annotation', closestAnnotation );
						$message.text( $.ucFirst( closestAnnotation.type ) + ': ' + closestAnnotation.text );
					} else if ( $message.data( 'annotation' ) !== null &&
							( !closestAnnotation || currentLine !== closestAnnotation.row ) ) {
						// If we are on a different line without an annotation, then blank the message
						$message.data( 'annotation', null );
						$message.text( '' );
					}

					// The cursor position has changed
					if ( shouldUpdateSelection || shouldUpdateLineInfo ) {
						// Adapted from Ajax.org's ace/ext/statusbar module
						status = [];

						if ( editor.$vimModeHandler ) {
							addToStatus( status, editor.$vimModeHandler.getStatusText() );
						} else if ( editor.commands.recording ) {
							addToStatus( status, 'REC' );
						}

						c = editor.selection.lead;
						addToStatus( status, ( c.row + 1 ) + ':' + c.column, '' );
						if ( !editor.selection.isEmpty() ) {
							r = editor.getSelectionRange();
							addToStatus( status, '(' + ( r.end.row - r.start.row ) + ':'  + ( r.end.column - r.start.column ) + ')' );
						}
						status.pop();
						$lineAndMode.text( status.join( '' ) );
					}

					shouldUpdateLineInfo = shouldUpdateSelection = shouldUpdateAnnotations = false;
				}

				// Function to delay/debounce updates for the StatusBar
				delayedUpdate = lang.delayedCall( function () {
					updateStatusBar( editor );
				}.bind( this ) );

				/**
				 * Click handler that allows you to skip to the next annotation
				 */
				$workerStatus.on( 'click', function ( e ) {
					if ( nextAnnotation ) {
						context.codeEditor.navigateTo( nextAnnotation.row, nextAnnotation.column );
						// Scroll up a bit to give some context
						context.codeEditor.scrollToRow( nextAnnotation.row - 3 );
						e.preventDefault();
					}
				} );

				editor.getSession().on( 'changeAnnotation', function () {
					shouldUpdateAnnotations = true;
					delayedUpdate.schedule( 100 );
				} );
				editor.on( 'changeStatus', function () {
					shouldUpdateLineInfo = true;
					delayedUpdate.schedule( 100 );
				} );
				editor.on( 'changeSelection', function () {
					shouldUpdateSelection = true;
					delayedUpdate.schedule( 100 );
				} );

				// Force update
				shouldUpdateLineInfo = shouldUpdateSelection = shouldUpdateAnnotations = true;
				updateStatusBar( editor );

				context.$statusBar.insertAfter( $( '.wikiEditor-ui-view-wikitext .wikiEditor-ui-bottom' ) );
			},
			'removeStatusBar': function () {
				context.codeEditor.getSession().removeListener( 'changeAnnotation' );
				context.codeEditor.removeListener( 'changeSelection' );
				context.codeEditor.removeListener( 'changeStatus' );
				context.nextAnnotation = null;
				context.$statusBar = null;

				$( '.codeEditor-status' ).remove();
			}

		} );

		/**
		 * Override the base functions in a way that lets
		 * us fall back to the originals when we turn off.
		 */
		saveAndExtend = function ( base, extended ) {
			var map;

			// $.map doesn't handle objects in jQuery < 1.6; need this for compat with MW 1.17
			map = function ( obj, callback ) {
				var key;

				for ( key in extended ) {
					if ( obj.hasOwnProperty( key ) ) {
						callback( obj[key], key );
					}
				}
			};
			map( extended, function ( func, name ) {
				if ( name in base ) {
					var orig = base[name];
					base[name] = function () {
						if ( context.codeEditorActive ) {
							return func.apply( this, arguments );
						}
						if ( orig ) {
							return orig.apply( this, arguments );
						}
						throw new Error( 'CodeEditor: no original function to call for ' + name );
					};
				} else {
					base[name] = func;
				}
			} );
		};

		saveAndExtend( context.fn, {
			'saveCursorAndScrollTop': function () {
				// Stub out textarea behavior
				return;
			},
			'restoreCursorAndScrollTop': function () {
				// Stub out textarea behavior
				return;
			},
			'saveSelection': function () {
				mw.log( 'codeEditor stub function saveSelection called' );
			},
			'restoreSelection': function () {
				mw.log( 'codeEditor stub function restoreSelection called' );
			},

			/* Needed for search/replace */
			'getContents': function () {
				return context.codeEditor.getSession().getValue();
			},

			/**
			 * Compatibility with the $.textSelection jQuery plug-in. When the iframe is in use, these functions provide
			 * equivilant functionality to the otherwise textarea-based functionality.
			 */

			'getElementAtCursor': function () {
				mw.log( 'codeEditor stub function getElementAtCursor called' );
			},

			/**
			 * Gets the currently selected text in the content
			 * DO NOT CALL THIS DIRECTLY, use $.textSelection( 'functionname', options ) instead
			 */
			'getSelection': function () {
				return context.codeEditor.getCopyText();
			},
			/**
			 * Inserts text at the begining and end of a text selection, optionally inserting text at the caret when
			 * selection is empty.
			 * DO NOT CALL THIS DIRECTLY, use $.textSelection( 'functionname', options ) instead
			 */
			'encapsulateSelection': function ( options ) {
				var sel, range, selText, isSample, text;

				// Does not yet handle 'ownline', 'splitlines' option
				sel = context.codeEditor.getSelection();
				range = sel.getRange();
				selText = context.fn.getSelection();
				isSample = false;

				if ( !selText ) {
					selText = options.peri;
					isSample = true;
				} else if ( options.replace ) {
					selText = options.peri;
				}

				text = options.pre;
				text += selText;
				text += options.post;
				context.codeEditor.insert( text );
				if ( isSample && options.selectPeri && !options.splitlines ) {
					// May esplode if anything has newlines, be warned. :)
					range.setStart( range.start.row, range.start.column + options.pre.length );
					range.setEnd( range.start.row, range.start.column + selText.length );
					sel.setSelectionRange( range );
				}
				return context.$textarea;
			},
			/**
			 * Gets the position (in resolution of bytes not nessecarily characters) in a textarea
			 * DO NOT CALL THIS DIRECTLY, use $.textSelection( 'functionname', options ) instead
			 */
			'getCaretPosition': function () {
				mw.log( 'codeEditor stub function getCaretPosition called' );
			},
			/**
			 * Sets the selection of the content
			 * DO NOT CALL THIS DIRECTLY, use $.textSelection( 'functionname', options ) instead
			 *
			 * @param start Character offset of selection start
			 * @param end Character offset of selection end
			 * @param startContainer Element in iframe to start selection in. If not set, start is a character offset
			 * @param endContainer Element in iframe to end selection in. If not set, end is a character offset
			 */
			'setSelection': function ( options ) {
				var doc, lines, offsetToPos, start, end, sel, range;

				// Ace stores positions for ranges as row/column pairs.
				// To convert from character offsets, we'll need to iterate through the document
				doc = context.codeEditor.getSession().getDocument();
				lines = doc.getAllLines();

				offsetToPos = function ( offset ) {
					var row, col, pos;

					row = 0;
					col = 0;
					pos = 0;

					while ( row < lines.length && pos + lines[row].length < offset ) {
						pos += lines[row].length;
						pos++; // for the newline
						row++;
					}
					col = offset - pos;
					return {row: row, column: col};
				};
				start = offsetToPos( options.start );
				end = offsetToPos( options.end );

				sel = context.codeEditor.getSelection();
				range = sel.getRange();
				range.setStart( start.row, start.column );
				range.setEnd( end.row, end.column );
				sel.setSelectionRange( range );
				return context.$textarea;
			},
			/**
			 * Scroll a textarea to the current cursor position. You can set the cursor position with setSelection()
			 * DO NOT CALL THIS DIRECTLY, use $.textSelection( 'functionname', options ) instead
			 */
			'scrollToCaretPosition': function () {
				mw.log( 'codeEditor stub function scrollToCaretPosition called' );
				return context.$textarea;
			},
			/**
			 * Scroll an element to the top of the iframe
			 * DO NOT CALL THIS DIRECTLY, use $.textSelection( 'functionname', options ) instead
			 *
			 * @param $element jQuery object containing an element in the iframe
			 * @param force If true, scroll the element even if it's already visible
			 */
			'scrollToTop': function () {
				mw.log( 'codeEditor stub function scrollToTop called' );
			}
		} );

		/* Setup the editor */
		context.fn.setupCodeEditorToolbar();
		if ( context.codeEditorActive ) {
			context.fn.setupCodeEditor();
		}

	};
}( jQuery, mediaWiki ) );
