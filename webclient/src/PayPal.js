import React, { useState, useEffect, useReducer } from 'react';

export function PayPal(props) {
	const { amount, custom, name } = props;

	return (
		<div className='paypal-container'>
			<form action='https://www.paypal.com/cgi-bin/webscr' method='post' target='_top'>
				<input type='hidden' name='cmd' value='_xclick' />
				<input type='hidden' name='business' value='info@protospace.ca' />
				<input type='hidden' name='lc' value='CA' />
				<input type='hidden' name='item_name' value={name} />
				<input type='hidden' name='amount' value={amount} />
				<input type='hidden' name='custom' value={custom} />
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
