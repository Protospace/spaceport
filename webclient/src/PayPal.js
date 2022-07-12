import React, { useState, useEffect, useReducer } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Container, Divider, Dropdown, Form, Grid, Header, Icon, Image, Input, Item, Menu, Message, Segment, Table } from 'semantic-ui-react';

export function PayPalPayNow(props) {
	const { amount, custom, name } = props;

	return (
		<div className='paypal-container'>
			<form action='https://www.paypal.com/cgi-bin/webscr' method='post' target='_top'>
				<input type='hidden' name='cmd' value='_xclick' />
				<input type='hidden' name='business' value='info@protospace.ca' />
				<input type='hidden' name='lc' value='CA' />
				<input type='hidden' name='item_name' value={name} />
				<input type='hidden' name='amount' value={amount} />
				<input type='hidden' name='custom' value={custom.replace(/\"/g, '`')} />
				<input type='hidden' name='currency_code' value='CAD' />
				<input type='hidden' name='button_subtype' value='services' />
				<input type='hidden' name='no_note' value='0' />
				<input type='hidden' name='tax_rate' value='0.000' />
				<input type='hidden' name='shipping' value='0.00' />
				<input type='hidden' name='bn' value='PP-BuyNowBF:btn_paynowCC_LG.gif:NonHostedGuest' />
				<input type='image' src='https://www.paypalobjects.com/en_US/i/btn/btn_paynowCC_LG.gif' border='0' name='submit' alt='PayPal - The safer, easier way to pay online!' />
				<img alt='' border='0' src='https://www.paypalobjects.com/en_US/i/scr/pixel.gif' width='1' height='1' />
			</form>
		</div>
	);
}

export function PayPalSubscribe(props) {
	const { amount, custom, name } = props;

	return (
		<div className='paypal-container'>
			<form action='https://www.paypal.com/cgi-bin/webscr' method='post' target='_top'>
				<input type='hidden' name='cmd' value='_xclick-subscriptions' />
				<input type='hidden' name='business' value='info@protospace.ca' />
				<input type='hidden' name='lc' value='US' />
				<input type='hidden' name='item_name' value={name} />
				<input type='hidden' name='no_note' value='1' />
				<input type='hidden' name='src' value='1' />
				<input type='hidden' name='a3' value={amount} />
				<input type='hidden' name='custom' value={custom.replace(/\"/g, '`')} />
				<input type='hidden' name='p3' value='1' />
				<input type='hidden' name='t3' value='M' />
				<input type='hidden' name='currency_code' value='CAD' />
				<input type='hidden' name='bn' value='PP-SubscriptionsBF:btn_subscribeCC_LG.gif:NonHostedGuest' />
				<input type='image' src='https://www.paypalobjects.com/en_US/i/btn/btn_subscribeCC_LG.gif' border='0' name='submit' alt='PayPal - The safer, easier way to pay online!' />
				<img alt='' border='0' src='https://www.paypalobjects.com/en_US/i/scr/pixel.gif' width='1' height='1' />
			</form>
		</div>
	);
}

export function PayPalSubscribeDeal(props) {
	const { amount, custom, name } = props;

	return (
		<div className='paypal-container'>
			<form action='https://www.paypal.com/cgi-bin/webscr' method='post' target='_top'>
				<input type='hidden' name='cmd' value='_xclick-subscriptions' />
				<input type='hidden' name='business' value='info@protospace.ca' />
				<input type='hidden' name='lc' value='US' />
				<input type='hidden' name='item_name' value={name}/>
				<input type='hidden' name='no_note' value='1' />
				<input type='hidden' name='a1' value={amount * 2} />
				<input type='hidden' name='p1' value='3' />
				<input type='hidden' name='t1' value='M' />
				<input type='hidden' name='src' value='1' />
				<input type='hidden' name='a3' value={amount} />
				<input type='hidden' name='custom' value={custom.replace(/\"/g, '`')} />
				<input type='hidden' name='p3' value='1' />
				<input type='hidden' name='t3' value='M' />
				<input type='hidden' name='currency_code' value='CAD' />
				<input type='hidden' name='bn' value='PP-SubscriptionsBF:btn_subscribeCC_LG.gif:NonHostedGuest' />
				<input type='image' src='https://www.paypalobjects.com/en_US/i/btn/btn_subscribeCC_LG.gif' border='0' name='submit' alt='PayPal - The safer, easier way to pay online!' />
				<img alt='' border='0' src='https://www.paypalobjects.com/en_US/i/scr/pixel.gif' width='1' height='1' />
			</form>
		</div>
	);
}

export function Subscribe(props) {
	const qs = useLocation().search;
	const params = new URLSearchParams(qs);
	const monthly_fees = params.get('monthly_fees') || false;
	const id = params.get('id') || false;

	return (
		<Container>
			<Header size='large'>Create a PayPal Subscription</Header>

			<p>Use this page to set up a Protospace membership subscription.</p>

			{monthly_fees && id ?
				<PayPalSubscribeDeal
					amount={monthly_fees}
					name='Protospace Membership'
					custom={JSON.stringify({ deal: 3, member: id })}
				/>
			:
				<p>Error, invalid subscribe link.</p>
			}

			<p>Click "Checkout as Guest" if you don't have a PayPal account.</p>
		</Container>
	);
}
