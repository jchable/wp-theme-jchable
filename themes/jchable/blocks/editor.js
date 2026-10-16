/**
 * Enregistre les blocs dynamiques côté éditeur. Le rendu vient du serveur
 * (ServerSideRender). Fichier écrit à la main, sans build.
 */
( function ( blocks, element, ServerSideRender, blockEditor ) {
	const el = element.createElement;

	[ 'jchable/post-filename', 'jchable/archive-path', 'jchable/request-path' ].forEach( function ( name ) {
		blocks.registerBlockType( name, {
			edit: function ( props ) {
				const postId = props.context && props.context.postId;
				return el(
					'div',
					blockEditor.useBlockProps(),
					el( ServerSideRender, {
						block: name,
						attributes: props.attributes,
						urlQueryArgs: postId ? { post_id: postId } : {},
					} )
				);
			},
			save: function () {
				return null;
			},
		} );
	} );
} )( window.wp.blocks, window.wp.element, window.wp.serverSideRender, window.wp.blockEditor );
