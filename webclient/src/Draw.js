import React, { useState, useEffect, useRef } from 'react';
import { Button, Divider, Header, Message } from 'semantic-ui-react';
import { requester } from './utils.js';

export function DrawingCanvas(props) {
	const { token } = props;
	const canvasRef = useRef(null);
	const contextRef = useRef(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [color, setColor] = useState('#000000');
	const lastColor = useRef('#000000');
	const [lineWidth, setLineWidth] = useState(5);
	const [error, setError] = useState(false);
	const [success, setSuccess] = useState(false);
	const eraserColor = '#FFFFFF';

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		context.lineCap = 'round';
		context.lineJoin = 'round';
		contextRef.current = context;

		const setCanvasSize = () => {
			const parent = canvas.parentElement;
			if (parent) {
				const newWidth = parent.offsetWidth;
				if (newWidth > 0) {
					const newHeight = Math.min(newWidth * 0.75, window.innerHeight * 0.5);
					if (canvas.width !== newWidth || canvas.height !== newHeight) {
						canvas.width = newWidth;
						canvas.height = newHeight;
						const ctx = canvas.getContext('2d');
						ctx.fillStyle = 'white';
						ctx.fillRect(0, 0, canvas.width, canvas.height);
					}
				}
			}
		};

		setTimeout(setCanvasSize, 100);
		window.addEventListener('resize', setCanvasSize);
		
		return () => window.removeEventListener('resize', setCanvasSize);
	}, []);

	const getEventCoords = (e) => {
		if (e.touches && e.touches[0]) {
			const canvas = canvasRef.current;
			const rect = canvas.getBoundingClientRect();
			const touch = e.touches[0];
			return { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top };
		}
		return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
	};

	const startDrawing = (e) => {
		if (e.cancelable) e.preventDefault();
		const { offsetX, offsetY } = getEventCoords(e);
		contextRef.current.strokeStyle = color;
		contextRef.current.lineWidth = lineWidth;
		contextRef.current.beginPath();
		contextRef.current.moveTo(offsetX, offsetY);
		setIsDrawing(true);
	};

	const finishDrawing = (e) => {
		if (e && e.cancelable) e.preventDefault();
		if (!isDrawing) return;
		contextRef.current.closePath();
		setIsDrawing(false);
	};

	const draw = (e) => {
		if (!isDrawing) {
			return;
		}
		if (e.cancelable) e.preventDefault();
		const { offsetX, offsetY } = getEventCoords(e);
		contextRef.current.lineTo(offsetX, offsetY);
		contextRef.current.stroke();
	};

	const clearCanvas = () => {
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		context.fillStyle = 'white';
		context.fillRect(0, 0, canvas.width, canvas.height);
	};

	const handleSubmit = () => {
		setSuccess(false);
		setError(false);
		const canvas = canvasRef.current;
		const image = canvas.toDataURL('image/png');
		requester('/stats/drawing/', 'POST', token, { image: image })
			.then(res => {
				setSuccess(true);
				setTimeout(() => setSuccess(false), 3000);
			})
			.catch(err => {
				setError('Failed to submit drawing.');
				console.error(err);
			});
	};
	
	const handleGreyChange = (e) => {
		const value = parseInt(e.target.value, 10);
		const hex = value.toString(16).padStart(2, '0');
		const newColor = `#${hex}${hex}${hex}`;
		setColor(newColor);
		if (newColor !== eraserColor) {
			lastColor.current = newColor;
		}
	};

	const greyValue = color.startsWith('#') && color.length === 7 ? parseInt(color.substring(1, 3), 16) : 0;

	return (
		<div style={{marginTop: '1.5rem'}}>
			<Divider />
			<Header size='medium'>Public Drawing Canvas</Header>
			<canvas
				ref={canvasRef}
				onMouseDown={startDrawing}
				onMouseUp={finishDrawing}
				onMouseMove={draw}
				onMouseLeave={finishDrawing}
				onTouchStart={startDrawing}
				onTouchEnd={finishDrawing}
				onTouchMove={draw}
				onTouchCancel={finishDrawing}
				style={{ border: '1px solid #ccc', background: 'white', touchAction: 'none', cursor: 'crosshair' }}
			/>
			<div style={{marginTop: '0.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem'}}>
				<input
					type='range'
					min='0'
					max='255'
					value={greyValue}
					onChange={handleGreyChange}
					style={{flexGrow: '1', minWidth: '100px'}}
				/>
				<div style={{width: '2rem', height: '2rem', backgroundColor: color, border: '1px solid #ccc'}} />
				
				<Button icon='paint brush' size='tiny' active={color !== eraserColor} onClick={() => setColor(lastColor.current)} />
				<Button icon='eraser' size='tiny' active={color === eraserColor} onClick={() => setColor(eraserColor)} />

				<input
					type='range'
					min='1'
					max='50'
					value={lineWidth}
					onChange={(e) => setLineWidth(e.target.value)}
					style={{flexGrow: '1', minWidth: '100px'}}
				/>
				<span style={{width: '2.5rem'}}>{lineWidth}px</span>
				
				<Button size='tiny' onClick={clearCanvas} style={{marginLeft: 'auto'}}>Clear</Button>
			</div>
			<Button primary onClick={handleSubmit} style={{marginTop: '1rem', width: '100%'}}>Submit Drawing</Button>
			{error && <Message error header={error} />}
			{success && <Message success header='Drawing submitted!' />}
		</div>
	);
}
