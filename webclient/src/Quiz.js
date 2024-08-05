import React, { useState, useEffect } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { MembersDropdown } from './Members.js';
import { isAdmin, BasicTable, requester } from './utils.js';
import { Button, Container, Form, Grid, Header, Message, Segment, Table } from 'semantic-ui-react';

export function SawstopQuiz(props) {
	const { token, user, refreshUser } = props;
	const [input, setInput] = useState({});
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleCheck = (e, v) => setInput({ ...input, [v.name]: v.checked });

	const handleSubmit = (e) => {
		if (loading) return;
		setLoading(true);
		setSuccess(false);
		const data = { ...input };
		requester('/quiz/sawstop/submit/', 'POST', token, data)
		.then(res => {
			setLoading(false);
			setSuccess(true);
			setError(false);
			refreshUser();
			window.scrollTo(0, 0);
		})
		.catch(err => {
			setLoading(false);
			console.log(err);
			setError(err.data);
		});
	};

	const makeProps = (name) => {
		input[name] = input[name] ?? false;

		return {
			name: name,
			onChange: handleCheck,
			checked: input[name] || false,
			value: input[name] || false,
			error: error[name],
		};
	};

	return (
		<Container>
			<Header size='large'>Sawstop Online Quiz</Header>

			{user.member.wood_cert_date ?
				<>
					<p>You have access to the SawStop ✅</p>
					<p>Enabled: {user.member.wood_cert_date}</p>

				</>
			:
				<p>Please review the following info and take the quiz.</p>
			}


			<Header size='medium'>Review Info</Header>

			<p>
				This quiz only covers SawStop safety brake features, not how to use a table saw.
				<b> You must have been marked attended on a Wood I class and a New Member Orientation for the quiz to work.</b>
				{' '}Check your attendance on the <Link to='/training'>Training page</Link>, contact a director if there's an error.
			</p>

			<Header size='small'>What can you cut?</Header>

			<ul>
				<li>Soft and hardwoods</li>
				<li>Plywood</li>
				<li>MDF</li>
				<li>Hardboard</li>
				<li>Test wet wood, pressure treated wood, and green wood in bypass mode</li>
				<li>Plastics, foam, charred / laser cut wood in bypass mode all the time</li>
				<li>Don't cut foil backed foam, any metals, or carbon fiber: the bits can trigger the brake from inside the saw after you leave</li>
			</ul>

			<Header size='small'>Bypass mode video</Header>

			<p><a href="https://www.youtube.com/watch?v=FaA5GA61MH0" target="_blank">https://www.youtube.com/watch?v=FaA5GA61MH0</a></p>

			<Header size='small'>Blade brake spacing video</Header>

			<p><a href="https://www.youtube.com/watch?v=fPFKcHhHY70" target="_blank">https://www.youtube.com/watch?v=fPFKcHhHY70</a></p>

			<Header size='small'>Dado stack video</Header>

			<p><a href="https://www.youtube.com/watch?v=X41ds_PN4N8" target="_blank">https://www.youtube.com/watch?v=X41ds_PN4N8</a></p>

			<p>For dato stacks thicker than 3/8” remove the arbor washer.</p>

			<Header size='small'>Other cautions</Header>

			<ul>
				<li>Let the blade spin down to a stop before touching anything. Assume if the blade is spinning it could be triggered.</li>
				<li>Keep metal things away from the saw.</li>
				<li>The safety system won't work if the SawStop loses power from the yellow on/off switch, RFID lockout, or wall.</li>
				<li>Clean blades before use. Choose blades that don't have coated teeth.</li>
				<li>Only use standard 10” blades with 3/32” to 3/16” kerf.</li>
			</ul>

			{!user.member.wood_cert_date &&
				<>
					<Header size='medium'>Quiz</Header>

					<Segment>
						<Form onSubmit={handleSubmit}>
							<Form.Field>
								<label>Agreement</label>
								<Form.Checkbox
									label='I have reviewed all of the above training material'
									{...makeProps('agree1')}
								/>
								<Form.Checkbox
									label='I understand that I am responsible for replacing the cartridge and blade on negligent triggers of the machine'
									{...makeProps('agree2')}
								/>
								<Form.Checkbox
									label='I have attended a Wood I class and New Member Orientation'
									{...makeProps('agree3')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What materials can lead to an accidental activation of the SawStop?</label>
								<Form.Checkbox
									label='Wet wood'
									{...makeProps('material1')}
								/>
								<Form.Checkbox
									label='Dry wood'
									{...makeProps('material2')}
								/>
								<Form.Checkbox
									label='Charred / laser cut wood'
									{...makeProps('material3')}
								/>
								<Form.Checkbox
									label='Carbon fibre'
									{...makeProps('material4')}
								/>
								<Form.Checkbox
									label='Metal foil-faced foam'
									{...makeProps('material5')}
								/>
								<Form.Checkbox
									label='Hot dogs'
									{...makeProps('material6')}
								/>
								<Form.Checkbox
									label='Plastic'
									{...makeProps('material7')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What materials must be cut in bypass mode all the time?</label>
								<Form.Checkbox
									label='Wet wood'
									{...makeProps('bypass1')}
								/>
								<Form.Checkbox
									label='Dry wood'
									{...makeProps('bypass2')}
								/>
								<Form.Checkbox
									label='Foam'
									{...makeProps('bypass3')}
								/>
								<Form.Checkbox
									label='Plastic'
									{...makeProps('bypass4')}
								/>
								<Form.Checkbox
									label='Charred / laser cut wood'
									{...makeProps('bypass5')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What materials must be tested in bypass mode before cutting?</label>
								<Form.Checkbox
									label='Wet wood'
									{...makeProps('tested1')}
								/>
								<Form.Checkbox
									label='Birch plywood'
									{...makeProps('tested2')}
								/>
								<Form.Checkbox
									label='Dry wood'
									{...makeProps('tested3')}
								/>
								<Form.Checkbox
									label='MDF'
									{...makeProps('tested4')}
								/>
								<Form.Checkbox
									label='Green wood'
									{...makeProps('tested5')}
								/>
								<Form.Checkbox
									label='Pressure treated wood'
									{...makeProps('tested6')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What materials should never be cut on the SawStop?</label>
								<Form.Checkbox
									label='Wet wood'
									{...makeProps('never1')}
								/>
								<Form.Checkbox
									label='Metal foil-faced foam'
									{...makeProps('never2')}
								/>
								<Form.Checkbox
									label='Green wood'
									{...makeProps('never3')}
								/>
								<Form.Checkbox
									label='Carbon fibre'
									{...makeProps('never4')}
								/>
								<Form.Checkbox
									label='Metals'
									{...makeProps('never5')}
								/>
								<Form.Checkbox
									label='Pressure treated wood'
									{...makeProps('never6')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What indicates material conductivity during bypass mode?</label>
								<Form.Checkbox
									label='The red LED flashes'
									{...makeProps('led1')}
								/>
								<Form.Checkbox
									label='The green LED flashes'
									{...makeProps('led2')}
								/>
								<Form.Checkbox
									label='A beeping sound is made'
									{...makeProps('led3')}
								/>
							</Form.Field>

							<Form.Field>
								<label>Can the SawStop trigger while spinning down normally?</label>
								<Form.Checkbox
									label='Yes, if turned off by the lockout button'
									{...makeProps('spin1')}
								/>
								<Form.Checkbox
									label='Yes, if turned off by the red paddle'
									{...makeProps('spin2')}
								/>
								<Form.Checkbox
									label='Yes, if turned off by the yellow on/off switch'
									{...makeProps('spin3')}
								/>
								<Form.Checkbox
									label='No'
									{...makeProps('spin4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>Can a metal tape measure trigger it while spinning down normally?</label>
								<Form.Checkbox
									label='Yes'
									{...makeProps('tape1')}
								/>
								<Form.Checkbox
									label='No'
									{...makeProps('tape2')}
								/>
							</Form.Field>

							<Form.Button loading={loading} error={error.non_field_errors}>
								Submit
							</Form.Button>
							{success && <div>Success!</div>}
						</Form>
					</Segment>
				</>
			}

		</Container>
	);
};
