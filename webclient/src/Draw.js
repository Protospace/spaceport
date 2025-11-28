import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button, Divider, Header, Container, Checkbox } from 'semantic-ui-react';
import { requester, staticUrl, isAdmin } from './utils.js';

function hexToHsl(hex) {
	let r = 0, g = 0, b = 0;
	if (hex.length === 4) {
		r = "0x" + hex[1] + hex[1];
		g = "0x" + hex[2] + hex[2];
		b = "0x" + hex[3] + hex[3];
	} else if (hex.length === 7) {
		r = "0x" + hex[1] + hex[2];
		g = "0x" + hex[3] + hex[4];
		b = "0x" + hex[5] + hex[6];
	}
	r = parseInt(r) / 255;
	g = parseInt(g) / 255;
	b = parseInt(b) / 255;
	let cmin = Math.min(r, g, b),
		cmax = Math.max(r, g, b),
		delta = cmax - cmin,
		h = 0, s = 0, l = 0;
	if (delta === 0) h = 0;
	else if (cmax === r) h = ((g - b) / delta) % 6;
	else if (cmax === g) h = (b - r) / delta + 2;
	else h = (r - g) / delta + 4;
	h = Math.round(h * 60);
	if (h < 0) h += 360;
	l = (cmax + cmin) / 2;
	s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	s = +(s * 100).toFixed(1);
	l = +(l * 100).toFixed(1);
	return [h, s, l];
}

function hslToHex(h, s, l) {
	s /= 100;
	l /= 100;
	let c = (1 - Math.abs(2 * l - 1)) * s,
		x = c * (1 - Math.abs((h / 60) % 2 - 1)),
		m = l - c / 2,
		r = 0, g = 0, b = 0;
	if (0 <= h && h < 60) {
		r = c; g = x; b = 0;
	} else if (60 <= h && h < 120) {
		r = x; g = c; b = 0;
	} else if (120 <= h && h < 180) {
		r = 0; g = c; b = x;
	} else if (180 <= h && h < 240) {
		r = 0; g = x; b = c;
	} else if (240 <= h && h < 300) {
		r = x; g = 0; b = c;
	} else if (300 <= h && h < 360) {
		r = c; g = 0; b = x;
	}
	r = Math.round((r + m) * 255);
	g = Math.round((g + m) * 255);
	b = Math.round((b + m) * 255);
	const toHex = c => ('0' + c.toString(16)).slice(-2);
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function DrawingCanvas(props) {
	const { user, token } = props;
	const canvasRef = useRef(null);
	const contextRef = useRef(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [color, setColor] = useState('#000000');
	const lastColor = useRef('#000000');
	const [lineWidth, setLineWidth] = useState(5);
	const [error, setError] = useState(false);
	const [success, setSuccess] = useState(false);
	const [showResetConfirm, setShowResetConfirm] = useState(false);
	const [history, setHistory] = useState([]);
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
						setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
					}
				}
			}
		};

		setTimeout(setCanvasSize, 100);
		window.addEventListener('resize', setCanvasSize);
		
		return () => window.removeEventListener('resize', setCanvasSize);
	}, []);

	useEffect(() => {
		const handleGlobalUp = () => {
			contextRef.current.closePath();
			setIsDrawing(false);
		};

		if (isDrawing) {
			window.addEventListener('mouseup', handleGlobalUp);
			window.addEventListener('touchend', handleGlobalUp);
		}

		return () => {
			window.removeEventListener('mouseup', handleGlobalUp);
			window.removeEventListener('touchend', handleGlobalUp);
		};
	}, [isDrawing]);

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
		if (!user) return;
		if (e.cancelable) e.preventDefault();
		setError(false);
		setSuccess(false);
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

		const context = canvasRef.current.getContext('2d');
		setHistory([...history, context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)]);
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
		setHistory([context.getImageData(0, 0, canvas.width, canvas.height)]);
	};

	const resetCanvasAndSettings = () => {
		clearCanvas();
		setColor('#000000');
		setLineWidth(5);
		lastColor.current = '#000000';
	};

	const handleUndo = () => {
		if (history.length <= 1) return;

		const newHistory = history.slice(0, -1);
		const lastState = newHistory[newHistory.length - 1];
		const context = canvasRef.current.getContext('2d');
		context.putImageData(lastState, 0, 0);
		setHistory(newHistory);
	};

	const isDrawingInsufficient = () => {
		const canvas = canvasRef.current;
		const context = canvas.getContext('2d');
		const pixelBuffer = new Uint32Array(
			context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
		);
		const nonWhitePixels = pixelBuffer.reduce((count, color) => color !== 0xFFFFFFFF ? count + 1 : count, 0);
		const totalPixels = canvas.width * canvas.height;

		if (totalPixels === 0) return true;

		const percentage = (nonWhitePixels / totalPixels) * 100;
		return percentage < 5;
	};

	const handleSubmit = () => {
		setSuccess(false);
		setError(false);

		if (isDrawingInsufficient()) {
			setError('Draw more.');
			return;
		}

		const originalCanvas = canvasRef.current;
		const outputCanvas = document.createElement('canvas');
		outputCanvas.width = 576;
		outputCanvas.height = 432;
		const context = outputCanvas.getContext('2d');

		context.fillStyle = 'white';
		context.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
		context.drawImage(originalCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

		const pngHeader = atob('UF9TX0RfQw==');
		const imageData = context.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
		const data = imageData.data;

		if (data.length >= pngHeader.length * 4) {
			for (let i = 0; i < pngHeader.length; i++) {
				data[i * 4 + 3] = pngHeader.charCodeAt(i);
			}
			context.putImageData(imageData, 0, 0);
		}

		const image = outputCanvas.toDataURL('image/png');
		requester('/drawing/', 'POST', token, { image: image })
			.then(res => {
				setSuccess(true);
				clearCanvas();
				setTimeout(() => setSuccess(false), 3000);
			})
			.catch(err => {
				setError('Failed to submit drawing.');
				console.error(err);
			});
	};
	
	const handleColorChange = (e) => {
		const newColor = e.target.value;
		setColor(newColor);
		if (newColor !== eraserColor) {
			lastColor.current = newColor;
		}
	};

	const handleLightnessChange = (e) => {
		const newLightness = e.target.value;
		const [h, s] = hexToHsl(lastColor.current);
		const newColor = hslToHex(h, s, newLightness);
		setColor(newColor);
		lastColor.current = newColor;
	};

	const isEraser = color === eraserColor;
	const activeColor = isEraser ? lastColor.current : color;
	const [h, s, l] = hexToHsl(activeColor);
	const lightness = l;
	const gradient = `linear-gradient(to right, ${hslToHex(h, s, 0)}, ${hslToHex(h, s, 50)}, ${hslToHex(h, s, 100)})`;

	return (
		<div style={{marginTop: '1.5rem', maxWidth: '24rem'}}>
			<Divider />
			<p>Send a drawing to the Bash Register:</p>
			<div style={{ position: 'relative' }}>
				<canvas
					ref={canvasRef}
					onMouseDown={startDrawing}
					onMouseUp={finishDrawing}
					onMouseMove={draw}
					onTouchStart={startDrawing}
					onTouchEnd={finishDrawing}
					onTouchMove={draw}
					onTouchCancel={finishDrawing}
					className='drawing-canvas'
					style={{ cursor: user ? 'crosshair' : 'default' }}
				/>
				{!user && (
					<div className='canvas-overlay'>
						Unauthorized
					</div>
				)}
				{showResetConfirm && (
					<div className='canvas-overlay' style={{flexDirection: 'column'}}>
						<p style={{padding: '0.5rem', backgroundColor: 'white'}}>Confirm reset?</p>
						<div>
							<Button color='red' onClick={() => { resetCanvasAndSettings(); setShowResetConfirm(false); }}>Reset</Button>
							<Button onClick={() => setShowResetConfirm(false)} style={{marginLeft: '2rem'}}>Cancel</Button>
						</div>
					</div>
				)}
			</div>
			<div className='drawing-controls'>
				<input type='color' value={color} onChange={handleColorChange} disabled={!user} className='color-picker-input' />
				
				<Button icon='paint brush' size='tiny' active={!isEraser} onClick={() => setColor(lastColor.current)} disabled={!user} />
				<Button icon='eraser' size='tiny' active={isEraser} onClick={() => setColor(eraserColor)} disabled={!user} />

				<div className='slider-container'>
					<svg width="100%" height="12" viewBox="0 0 100 12" preserveAspectRatio="none" style={{marginBottom: '2px'}}>
						<path d="M0,5.5 Q50,0 100,0 L100,12 Q50,12 0,6.5 Z" fill="#bbb" />
					</svg>
					<input
						type='range'
						min='1'
						max='50'
						value={lineWidth}
						onChange={(e) => setLineWidth(e.target.value)}
						disabled={!user}
					/>
				</div>

				<div className='slider-container'>
					<div className='gradient-box' style={{background: gradient}}></div>
					<input
						type='range'
						min='0'
						max='100'
						value={lightness}
						onChange={handleLightnessChange}
						disabled={!user || isEraser}
					/>
				</div>
				
				<div className='drawing-actions'>
					<Button icon='undo' size='tiny' onClick={handleUndo} disabled={!user || history.length <= 1} />
					<Button size='tiny' onClick={() => setShowResetConfirm(true)} disabled={!user}>Reset</Button>
				</div>
			</div>
			<div className='submit-drawing-area'>
				<Button primary onClick={handleSubmit} disabled={!user}>Submit Drawing</Button>
				<Link to='/gallery' style={{marginLeft: '1rem'}}>[gallery]</Link>
			</div>
			{error && <p>Error: {error}</p>}
			{success && <p>Success!</p>}
		</div>
	);
}


export function Gallery(props) {
	const { token, user } = props;
	const [drawings, setDrawings] = useState(false);
	const [error, setError] = useState(false);
	const [showDeleted, setShowDeleted] = useState(false);
	const [confirmDeleteId, setConfirmDeleteId] = useState(null);

	useEffect(() => {
		requester('/drawing/', 'GET', token)
		.then(res => {
			const drawingsWithAngles = res.results.map(d => ({...d, angle: Math.random() * 8 - 4}));
			setDrawings(drawingsWithAngles);
			setError(false);
		})
		.catch(err => {
			console.log(err);
			setError(true);
		});
	}, [token]);

	const handleDelete = (drawingId) => {
		requester(`/drawing/${drawingId}/`, 'PUT', token, { is_hidden: true })
			.then(res => {
				setDrawings(drawings.map(d => d.id === drawingId ? { ...d, is_hidden: true } : d));
				setConfirmDeleteId(null);
			})
			.catch(err => {
				console.log(err);
			});
	};

	const handleUndelete = (drawingId) => {
		requester(`/drawing/${drawingId}/`, 'PUT', token, { is_hidden: false })
			.then(res => {
				setDrawings(drawings.map(d => d.id === drawingId ? { ...d, is_hidden: false } : d));
			})
			.catch(err => {
				console.log(err);
			});
	};

	const DeleteButton = ({ drawing }) => {
		if (!user || (user.member.id !== 1685 && user.member.id !== drawing.member_id)) {
			return null;
		}
		if (drawing.is_hidden) {
			return <Button size='tiny' onClick={() => handleUndelete(drawing.id)}>Undelete</Button>;
		}
		return <Button size='tiny' onClick={() => setConfirmDeleteId(drawing.id)}>Delete</Button>;
	};

	return (
		<Container>
			<Header size='large'>Gallery</Header>
			{user.member.id === 1685 &&
				<Checkbox label='Show deleted' checked={showDeleted} onChange={() => setShowDeleted(!showDeleted)} />
			}

			{!error ?
				drawings ?
					<div className='gallery-container'>
						{drawings.filter(d => showDeleted || !d.is_hidden).map(drawing => (
							<div key={drawing.id} className='polaroid' style={{
								background: drawing.is_hidden ? '#aaa' : 'white',
								transform: `rotate(${drawing.angle}deg)`,
							}}>
								<img src={`${staticUrl}/${drawing.filename}`} className='polaroid-img' alt={`Drawing by ${drawing.member_name}`} />
								<div className='polaroid-caption'>
									<span style={{color: 'black'}}>{drawing.member_name}</span>
									<DeleteButton drawing={drawing} />
								</div>
								{confirmDeleteId === drawing.id && (
									<div className='canvas-overlay' style={{flexDirection: 'column'}}>
										<p style={{padding: '0.5rem', backgroundColor: 'white'}}>Confirm delete?</p>
										<div>
											<Button color='red' onClick={() => handleDelete(drawing.id)}>Delete</Button>
											<Button onClick={() => setConfirmDeleteId(null)} style={{marginLeft: '2rem'}}>Cancel</Button>
										</div>
									</div>
								)}
							</div>
						))}
					</div>
				:
					<p>Loading...</p>
			:
				<p>Error loading.</p>
			}
		</Container>
	);
}
