import React from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Container, Header, Popup, Table } from 'semantic-ui-react';
import moment from 'moment-timezone';
import { getInstructor, useIsMobile } from './utils.js';

export function CertList(props) {
	const { member } = props;
	const isMobile = useIsMobile();

	const MoreCert = (tools) => (<Popup content={
		<>
			<p>Allows access to:</p>
			<p>{tools}</p>
		</>
	} trigger={<a>[more]</a>} />);

	return (
		<Table basic='very'>
			{!isMobile && <Table.Header>
				<Table.Row>
					<Table.HeaderCell>Name</Table.HeaderCell>
					<Table.HeaderCell>Enabled</Table.HeaderCell>
					<Table.HeaderCell>Course</Table.HeaderCell>
				</Table.Row>
			</Table.Header>}

			<Table.Body>
				<Table.Row>
					<Table.Cell>Common {MoreCert('Any tool larger than a screwdriver.')}</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.vetted_date || member.orientation_date ? 'Yes' : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/249'>New Members: Orientation and Basic Safety</Link></Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>SawStop</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.wood_cert_date ? 'Yes, ' + member.wood_cert_date : 'No'}</Table.Cell>
					<Table.Cell>
						<Link to='/quiz/sawstop'>Sawstop Online Quiz</Link>
						{' '}or <Link to='/courses/261'>Woodworking Tools 1: Intro to Saws</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Drum Sander</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.wood2_cert_date ? 'Yes, ' + member.wood2_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/401'>Woodworking Tools 2: Jointer, Thickness Planer, Drum Sander</Link></Table.Cell>
				</Table.Row>
				{false && <Table.Row>
					<Table.Cell>Lathe {MoreCert('Manual metal lathe.')}</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.lathe_cert_date ? 'Yes, ' + member.lathe_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/281'>Metal: Metal Cutting & Manual Lathe</Link></Table.Cell>
				</Table.Row>}
				{false && <Table.Row>
					<Table.Cell>Mill {MoreCert('Manual metal mill.')}</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.mill_cert_date ? 'Yes, ' + member.mill_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/283'>Metal: Manual Mill & Advanced Lathe</Link></Table.Cell>
				</Table.Row>}
				<Table.Row>
					<Table.Cell>Tormach CNC</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.tormach_cnc_cert_date ? 'Yes, ' + member.tormach_cnc_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/259'>Tormach: CAM and Tormach Intro</Link></Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Precix CNC</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.precix_cnc_cert_date ? 'Yes, ' + member.precix_cnc_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/428'>Basic CNC Wood Router</Link></Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Thunder Laser</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.rabbit_cert_date ? 'Yes, ' + member.rabbit_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/247'>Laser: Cutting and Engraving</Link></Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Trotec Laser</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.trotec_cert_date ? 'Yes, ' + member.trotec_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/321'>Laser: Trotec Course</Link></Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Embroidery Machine</Table.Cell>
					<Table.Cell>{isMobile && 'Enabled: '}{member.embroidery_cert_date ? 'Yes, ' + member.embroidery_cert_date : 'No'}</Table.Cell>
					<Table.Cell><Link to='/courses/447'>Embroidery Machine Overview</Link></Table.Cell>
				</Table.Row>
			</Table.Body>
		</Table>
	);
};

export function TrainingList(props) {
	const { training } = props;
	const isMobile = useIsMobile();

	return (
		<Table basic='very'>
			{!isMobile && <Table.Header>
				<Table.Row>
					<Table.HeaderCell>Course / Event Name</Table.HeaderCell>
					<Table.HeaderCell>Class Date</Table.HeaderCell>
					<Table.HeaderCell>Status</Table.HeaderCell>
					<Table.HeaderCell>Instructor</Table.HeaderCell>
				</Table.Row>
			</Table.Header>}

			<Table.Body>
				{training.slice().sort((a, b) => a.session.datetime < b.session.datetime ? 1 : -1).map(x =>
					<Table.Row key={x.id}>
						<Table.Cell>{x.session.course_data.name}</Table.Cell>
						<Table.Cell>
							<Link style={{whiteSpace: 'nowrap'}} to={'/classes/'+x.session.id}>{moment(x.session.datetime).tz('America/Edmonton').format('ll')}</Link>
						</Table.Cell>
						<Table.Cell>{isMobile && 'Attendance: '}{x.attendance_status}</Table.Cell>
						<Table.Cell>{isMobile && 'Instructor: '}{getInstructor(x.session)}</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table>
	);
};


export function Training(props) {
	const { user } = props;

	return (
		<Container>
			<Header size='large'>Your Machine Access</Header>

			<p>These control access to the machine lockout devices.</p>

			<CertList member={user.member} />

			<p>Access is based on the courses you've taken. If there's any errors, please email <a href='mailto:directors@protospace.ca'>directors@protospace.ca</a>.</p>

			<Header size='large'>Your Training</Header>

			{user.training.length ?
				<TrainingList training={user.training} />
			:
				<p>No training yet! Sign up for a course to take a class.</p>
			}
		</Container>
	);
};
