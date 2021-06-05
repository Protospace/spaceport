import React from 'react';
import { Link } from 'react-router-dom';
import './light.css';
import { Container, Header, Popup, Table } from 'semantic-ui-react';
import moment from 'moment';
import { getInstructor } from './utils.js';

export function CertList(props) {
	const { member } = props;

	const MoreCert = (tools) => (
		<Popup
			content={
				<>
					<p>Allows access to:</p>
					<p>{tools}</p>
				</>
			}
			trigger={<a>[more]</a>}
		/>
	);

	return (
		<Table basic="very">
			<Table.Header>
				<Table.Row>
					<Table.HeaderCell>Name</Table.HeaderCell>
					<Table.HeaderCell>Certification</Table.HeaderCell>
					<Table.HeaderCell>Course</Table.HeaderCell>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				<Table.Row>
					<Table.Cell>
						Common {MoreCert('Anything larger than a screwdriver.')}
					</Table.Cell>
					<Table.Cell>
						{member.vetted_date || member.orientation_date
							? 'Yes'
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/249">
							New Members: Orientation and Basic Safety
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>
						Wood 1{' '}
						{MoreCert('Table saw, band saw, chop saw, router.')}
					</Table.Cell>
					<Table.Cell>
						{member.wood_cert_date
							? 'Yes, ' + member.wood_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/261">
							Woodworking Tools 1: Intro to Saws
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>
						Wood 2{' '}
						{MoreCert('Jointer, thickness planer, drum sander.')}
					</Table.Cell>
					<Table.Cell>
						{member.wood2_cert_date
							? 'Yes, ' + member.wood2_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/401">
							Woodworking Tools 2: Jointer, Thickness Planer, Drum
							Sander
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>
						Lathe {MoreCert('Manual metal lathe.')}
					</Table.Cell>
					<Table.Cell>
						{member.lathe_cert_date
							? 'Yes, ' + member.lathe_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/281">
							Metal: Metal Cutting & Manual Lathe
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>
						Mill {MoreCert('Manual metal mill.')}
					</Table.Cell>
					<Table.Cell>
						{member.mill_cert_date
							? 'Yes, ' + member.mill_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/283">
							Metal: Manual Mill & Advanced Lathe
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>
						CNC {MoreCert('Tormach metal CNC, CNC wood router.')}
					</Table.Cell>
					<Table.Cell>
						{member.cnc_cert_date
							? 'Yes, ' + member.cnc_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/259">
							Tormach: CAM and Tormach Intro
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Rabbit Laser</Table.Cell>
					<Table.Cell>
						{member.rabbit_cert_date
							? 'Yes, ' + member.rabbit_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/247">
							Laser: Cutting and Engraving
						</Link>
					</Table.Cell>
				</Table.Row>
				<Table.Row>
					<Table.Cell>Trotec Laser</Table.Cell>
					<Table.Cell>
						{member.trotec_cert_date
							? 'Yes, ' + member.trotec_cert_date
							: 'No'}
					</Table.Cell>
					<Table.Cell>
						<Link to="/courses/321">Laser: Trotec Course</Link>
					</Table.Cell>
				</Table.Row>
			</Table.Body>
		</Table>
	);
}

export function TrainingList(props) {
	const { training } = props;

	return (
		<Table basic="very">
			<Table.Header>
				<Table.Row>
					<Table.HeaderCell>Course / Event Name</Table.HeaderCell>
					<Table.HeaderCell>Class Date</Table.HeaderCell>
					<Table.HeaderCell>Status</Table.HeaderCell>
					<Table.HeaderCell>Instructor</Table.HeaderCell>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				{training
					.slice()
					.sort((a, b) =>
						a.session.datetime < b.session.datetime ? 1 : -1
					)
					.map((x) => (
						<Table.Row key={x.id}>
							<Table.Cell>{x.session.course_name}</Table.Cell>
							<Table.Cell>
								<Link to={'/classes/' + x.session.id}>
									{moment(x.session.datetime).format(
										'MMMM Do YYYY'
									)}
								</Link>
							</Table.Cell>
							<Table.Cell>{x.attendance_status}</Table.Cell>
							<Table.Cell>{getInstructor(x.session)}</Table.Cell>
						</Table.Row>
					))}
			</Table.Body>
		</Table>
	);
}

export function Training(props) {
	const { user } = props;

	return (
		<Container>
			<Header size="large">Certifications</Header>

			<CertList member={user.member} />

			<p>
				Certifications are based on the courses you've taken. If there's
				any errors, please email{' '}
				<a href="mailto:directors@protospace.ca">
					directors@protospace.ca
				</a>
				.
			</p>

			<Header size="large">Training</Header>

			{user.training.length ? (
				<TrainingList training={user.training} />
			) : (
				<p>No training yet! Sign up for a course to take a class.</p>
			)}
		</Container>
	);
}
