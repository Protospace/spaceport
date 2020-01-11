import React from 'react';
import { Container, Icon } from 'semantic-ui-react';

export function Footer() {
	return (
		<div className='footer'>
			<Container>
				<p>
					<img alt='site logo' src='/logo-short.svg' className='logo' />
				</p>

				<p className='text'>
					Contact us: <a href='mailto:info@protospace.ca' target='_blank' rel='noopener noreferrer'>info@protospace.ca</a>
				</p>

				<p className='text'>
					Created and hosted by Protospace members for Protospace members.
				</p>

				<p className='text'>
					Spaceport is free and open-source software. <a href='https://github.com/Protospace/spaceport' target='_blank' rel='noopener noreferrer'>Click here</a> to view the source code and license.
				</p>

				<p>
					<a href='https://instagram.com/protospace' target='_blank' rel='noopener noreferrer' aria-label='link to our instagram'>
						<Icon name='instagram' size='large' />
					</a>
					<a href='https://twitter.com/protospace' target='_blank' rel='noopener noreferrer' aria-label='link to our twitter'>
						<Icon name='twitter' size='large' />
					</a>
					<a href='https://youtube.com/user/calgaryprotospace/playlists' target='_blank' rel='noopener noreferrer' aria-label='link to our youtube'>
						<Icon name='youtube' size='large' />
					</a>
					<a href='https://github.com/Protospace' target='_blank' rel='noopener noreferrer' aria-label='link to our github'>
						<Icon name='github' size='large' />
					</a>
				</p>

				<p>© 2020 Calgary Protospace Ltd.</p>

			</Container>
		</div>
	);
};
