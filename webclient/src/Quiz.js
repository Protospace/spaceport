import React, { useState, useEffect } from 'react';
import { Link, useParams, useHistory } from 'react-router-dom';
import './light.css';
import { MembersDropdown } from './Members.js';
import { isAdmin, BasicTable, requester } from './utils.js';
import { Button, Container, Form, Grid, Header, Message, Segment, Table } from 'semantic-ui-react';

export function ScannerQuiz(props) {
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
		requester('/quiz/scanner/submit/', 'POST', token, data)
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
			<Header size='large'>3D Scanner Online Quiz</Header>

			{user.member.scanner_cert_date ?
				<>
					<p>You have access to the 3D Scanner ✅</p>
					<p>Enabled: {user.member.scanner_cert_date}</p>

				</>
			:
				<p>Please review the following info and take the quiz.</p>
			}

			<p>
				This quiz only covers an agreement to check out the Creality RaptorX 3D Scanner.
				<b> You must have been marked attended on the New Member Orientation for the quiz to work.</b>
				{' '}Check your attendance on the <Link to='/training'>Training page</Link>, contact a director if there's an error.
			</p>

			<Header size='medium'>Protospace Scanner Checkout Agreement</Header>

			<p>
				By checking out a scanner from Protospace, you agree to the following terms and conditions:
			</p>

			<Header size='small'>1. Liability for Damage or Loss:</Header>

			<p>
				You accept full responsibility for the scanner and its components while it is in your possession. In the event of damage, loss, or the return of the scanner with missing parts, you agree to cover repair or replacement costs up to a possible maximum of $1,000 CAD.
			</p>

			<Header size='small'>2. Condition Validation Upon Checkout:</Header>

			<p>
				You are required to thoroughly validate the condition of the scanner and its components at the time of checkout. Failure to perform this validation will result in the assumption of liability for any pre-existing damage caused by the previous user, unless otherwise documented.
			</p>

			<Header size='small'>3. Condition Upon Return:</Header>

			<p>
				You must return the scanner in fully functional condition, including the following parts and accessories:
			</p>

			<ul>
				<li>Creality RaptorX 3D Scanner</li>
				<li>Scan Bridge Wireless Scanning Charging Handle</li>
				<li>High Precision Glass Calibration Plate</li>
				<li>Hand-tightening quick-release card</li>
				<li>Magnetic phone holder</li>
				<li>WIFI 6 USB Wireless adapter</li>
				<li>Adapter + adapter</li>
				<li>USB 3.0 data cable (Type-C/Type-A)</li>
				<li>Scan Bridge Data Cable</li>
				<li>Fast charging data cable</li>
				<li>Type-C Adapter</li>
				<li>Cleaning cloth</li>
				<li>Lanyard</li>
			</ul>

			<p>
				Failure to return the scanner with all listed parts in working order may result in financial liability as outlined in Section 1 and may also affect your membership status with Protospace.
			</p>

			<Header size='small'>4. Property Restrictions:</Header>

			<p>
				The scanner must remain on Protospace premises at all times. Removing the scanner from Protospace property will be considered a violation of this agreement and may result in the termination of your membership.
			</p>

			<Header size='small'>5. Reporting Damage or Missing Components:</Header>

			<p>
				Any damage to the scanner or missing components discovered during checkout, use, or return must be promptly reported to the Protospace members or directors. Failure to report such issues may result in additional liability.
			</p>

			<Header size='small'>6. Membership Impact:</Header>

			<p>
				Protospace reserves the right to review and potentially suspend or terminate your membership privileges if the scanner is not returned in compliance with the terms outlined above.
			</p>

			<Header size='small'>7. Acknowledgment and Agreement:</Header>

			<p>
				By checking the agree box below in the quiz, you acknowledge that you read and accept these terms and conditions above as a binding agreement.
			</p>

			<Header size='medium'>The Check Out and In Process</Header>

			<Header size='small'>1. Access the Locker:</Header>

			<p>
				Tap your access card on the badge scanner to unlock the locker.
			</p>

			<Header size='small'>2. Retrieve the Scanner Case:</Header>

			<p>
				Carefully pull out the case containing the 3D laser scanner.
			</p>

			<Header size='small'>3. Inspect the Contents:</Header>

			<p>
				Open the case and check that all components are present and undamaged. Verify the presence of the following items:
			</p>

			<ul>
				<li>Creality RaptorX 3D Scanner</li>
				<li>Scan Bridge Wireless Scanning Charging Handle</li>
				<li>High Precision Glass Calibration Plate</li>
				<li>Hand-tightening quick-release card</li>
				<li>Magnetic phone holder</li>
				<li>WIFI 6 USB Wireless adapter</li>
				<li>Adapter + adapter</li>
				<li>USB 3.0 data cable (Type-C/Type-A)</li>
				<li>Scan Bridge Data Cable</li>
				<li>Fast charging data cable</li>
				<li>Type-C Adapter</li>
				<li>Cleaning cloth</li>
				<li>Lanyard</li>
			</ul>

			<Header size='small'>4. Address Issues (If Any):</Header>

			<p>
				If anything is missing or damaged, close the case, return it to its locker, and report the findings to the membership or directors.
			</p>

			<Header size='small'>5. Proceed with Checkout (If No Issues):</Header>

			<p>
				If everything is in order, use the 3D laser scanner as needed.
			</p>

			<Header size='small'>6. Post-Use Verification:</Header>

			<p>
				Once completed with your use, open the case again and verify the contents to ensure all components are intact and properly organized.
			</p>

			<Header size='small'>7. Scan and Return the Case:</Header>

			<p>
				Finally, tap your access card on the badge scanner to log the return, and place the case back into its locker.
			</p>



			{!user.member.scanner_cert_date &&
				<>
					<Header size='medium'>Quiz</Header>

					<Segment>
						<Form onSubmit={handleSubmit}>
							<Form.Field>
								<label>Agreement</label>
								<Form.Checkbox
									label='I agree to the Protospace Scanner Checkout Agreement'
									{...makeProps('agree1')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What is the maximum financial liability a user could face for damage or loss of the scanner and its components?</label>
								<Form.Checkbox
									label='$500 CAD'
									{...makeProps('value1')}
								/>
								<Form.Checkbox
									label='$750 CAD'
									{...makeProps('value2')}
								/>
								<Form.Checkbox
									label='$1000 CAD'
									{...makeProps('value3')}
								/>
								<Form.Checkbox
									label='$1500 CAD'
									{...makeProps('value4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What must a user do before accepting the scanner during checkout?</label>
								<Form.Checkbox
									label='Read the instruction manual'
									{...makeProps('before1')}
								/>
								<Form.Checkbox
									label='Thoroughly validate the condition of the scanner and its components'
									{...makeProps('before2')}
								/>
								<Form.Checkbox
									label='Sign a paper agreement'
									{...makeProps('before3')}
								/>
								<Form.Checkbox
									label='Test the scanner'
									{...makeProps('before4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What is the consequence of failing to validate the scanner's condition upon checkout?</label>
								<Form.Checkbox
									label='A fine of $200 CAD'
									{...makeProps('validate1')}
								/>
								<Form.Checkbox
									label='Immediate membership suspension'
									{...makeProps('validate2')}
								/>
								<Form.Checkbox
									label='Assumption of liability for pre-existing damage unless documented'
									{...makeProps('validate3')}
								/>
								<Form.Checkbox
									label='Inability to check out the scanner'
									{...makeProps('validate4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>Which item is <i>not</i> listed as part of the scanner’s accessories?</label>
								<Form.Checkbox
									label='WIFI 6 USB Wireless Adapter'
									{...makeProps('items1')}
								/>
								<Form.Checkbox
									label='Hand-tightening quick-release card'
									{...makeProps('items2')}
								/>
								<Form.Checkbox
									label='3D Laser Calibration Stand'
									{...makeProps('items3')}
								/>
								<Form.Checkbox
									label='Cleaning cloth'
									{...makeProps('items4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What is the rule regarding the scanner’s location during checkout?</label>
								<Form.Checkbox
									label='It must remain on Protospace premises at all times'
									{...makeProps('location1')}
								/>
								<Form.Checkbox
									label='It can only be taken home for 24 hours'
									{...makeProps('location2')}
								/>
								<Form.Checkbox
									label='It must be used only in the designated scanner room'
									{...makeProps('location3')}
								/>
								<Form.Checkbox
									label='It can be transported within a 5 km radius'
									{...makeProps('location4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What should a user do if they discover damage or missing components during checkout?</label>
								<Form.Checkbox
									label='Attempt to repair the damage themselves'
									{...makeProps('damage1')}
								/>
								<Form.Checkbox
									label='Report the findings to membership or directors'
									{...makeProps('damage2')}
								/>
								<Form.Checkbox
									label='Continue using the scanner regardless'
									{...makeProps('damage3')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What could happen if a user fails to return the scanner in compliance with the agreement?</label>
								<Form.Checkbox
									label='Their Protospace membership may be reviewed, suspended, or terminated'
									{...makeProps('compliance1')}
								/>
								<Form.Checkbox
									label='They may receive a warning but no other consequences'
									{...makeProps('compliance2')}
								/>
								<Form.Checkbox
									label='They will lose access to Protospace for one week'
									{...makeProps('compliance3')}
								/>
								<Form.Checkbox
									label='They will be fined $50'
									{...makeProps('compliance4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>Which of the following actions is <i>not</i> part of the return process?</label>
								<Form.Checkbox
									label='Logging the return by tapping an access card on the badge scanner'
									{...makeProps('return1')}
								/>
								<Form.Checkbox
									label='Verifying the contents of the case after use'
									{...makeProps('return2')}
								/>
								<Form.Checkbox
									label='Reporting any issues to the Protospace directors'
									{...makeProps('return3')}
								/>
								<Form.Checkbox
									label='Leaving the locker unlocked in the shared workspace'
									{...makeProps('return4')}
								/>
							</Form.Field>

							<Form.Field>
								<label>What is the first step when accessing the scanner?</label>
								<Form.Checkbox
									label='Inspecting the contents of the case'
									{...makeProps('access1')}
								/>
								<Form.Checkbox
									label='Tapping the access card on the badge scanner to unlock the locker'
									{...makeProps('access2')}
								/>
								<Form.Checkbox
									label='Logging the scanner usage online'
									{...makeProps('access3')}
								/>
								<Form.Checkbox
									label='Reporting to the front desk'
									{...makeProps('access4')}
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

			Fine to cut:
			<ul>
				<li>Soft and hardwoods</li>
				<li>Plywood</li>
				<li>MDF</li>
				<li>Hardboard</li>
			</ul>

			Test first in bypass mode first:
			<ul>
				<li>Wet wood</li>
				<li>Pressure treated wood</li>
				<li>Green wood</li>
			</ul>

			Cut in bypass mode all the time:
			<ul>
				<li>Plastics</li>
				<li>Foam</li>
				<li>Charred / laser cut wood</li>
			</ul>

			Never cut:
			<ul>
				<li>Foil-backed foam</li>
				<li>Metals</li>
				<li>Carbon fibre</li>
				<li>...the bits can trigger the brake from inside after you leave</li>
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
				<li>The safety system only works if the SawStop is turned off via the <b>red paddle</b>. It will not trigger if it loses power from the yellow switch, RFID lockout, or wall.</li>
				<li>Keep metal things away from the saw.</li>
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
								<label>Can a metal tape measure trigger it while spinning down?</label>
								<Form.Checkbox
									label='Yes'
									{...makeProps('tape1')}
								/>
								<Form.Checkbox
									label='No'
									{...makeProps('tape2')}
								/>
							</Form.Field>

							<Form.Field>
								<label>Can it trigger while spinning down?</label>
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
