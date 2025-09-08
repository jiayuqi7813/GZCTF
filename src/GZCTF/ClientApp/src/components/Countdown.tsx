import { FC, useState, useEffect, useCallback, useRef } from 'react';
import api from '@Api';
import classes from '@Styles/Countdown.module.css';
import { Center, Stack, Text, Title } from '@mantine/core';
import { useUser } from '@Hooks/useUser';
import { useTranslation } from 'react-i18next';
import { showErrorMsg } from '@Utils/Shared';

const PIXEL_SIZE = 12;

const Countdown: FC = () => {
  const { t } = useTranslation();

  const { data: countdownData, mutate, } = api.countdown.useCountdownGetCountdown({ refreshInterval: 5000 });
  const { user: currentUser } = useUser();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const CANVAS_WIDTH = countdownData?.width || 0;
  const CANVAS_HEIGHT = countdownData?.height || 0;

  const centerX = Math.floor(CANVAS_WIDTH / 2);
  const centerY = Math.floor(CANVAS_HEIGHT / 2);
  const timeText = "00:00:00:00"; // "DD:HH:MM:SS"
  const totalWidth = timeText.length * 4 - 1; // 每个字符宽3+1间隔，最后一个字符没有间隔
  const startX = centerX - Math.floor(totalWidth / 2);
  const startY = centerY - 2; // 高度5

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [pixels, setPixels] = useState<boolean[][]>(() =>
    Array(CANVAS_HEIGHT)
      .fill(null)
      .map(() => Array(CANVAS_WIDTH).fill(false))
  );

  useEffect(() => {
    // data是行，列的顺序压缩的数据，每个像素的01每8位压缩成一个byte，然后转成base64
    if (countdownData?.data) {
      const binaryString = atob(countdownData.data);
      const byteArray = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
      }

      const newPixels: boolean[][] = Array(CANVAS_HEIGHT)
        .fill(null)
        .map(() => Array(CANVAS_WIDTH).fill(false));
      let bitIndex = 0;
      for (let byte of byteArray) {
        for (let i = 7; i >= 0; i--) {
          const bit = (byte >> i) & 1;
          const row = Math.floor(bitIndex / CANVAS_WIDTH);
          const col = bitIndex % CANVAS_WIDTH;
          if (row < CANVAS_HEIGHT) {
            newPixels[row][col] = bit === 1;
            bitIndex++;
          } else {
            break;
          }
        }
      }
      setPixels(newPixels);
    }
  }, [countdownData?.data]);

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!countdownData || !countdownData.startTimeUtc) return;

      const now = new Date().getTime();
      const target = countdownData.startTimeUtc!;
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [countdownData?.startTimeUtc, setTimeLeft]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH * PIXEL_SIZE, CANVAS_HEIGHT * PIXEL_SIZE);

    for (let y = 0; y < CANVAS_HEIGHT; y++) {
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        const isProtectedArea = x >= startX && x < startX + totalWidth && y >= startY && y < startY + 5;
        ctx.fillStyle = isProtectedArea ? 'gray' : pixels?.[y]?.[x] ? 'white' : 'black';
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    // 绘制倒计时数字
    const formatNumber = (num: number) => num.toString().padStart(2, '0');
    const timeText = `${formatNumber(timeLeft.days)}:${formatNumber(timeLeft.hours)}:${formatNumber(timeLeft.minutes)}:${formatNumber(timeLeft.seconds)}`;


    const digitPatterns: { [key: string]: boolean[][] } = {
      "0": [
        [true, true, true],
        [true, false, true],
        [true, false, true],
        [true, false, true],
        [true, true, true],
      ],
      "1": [
        [false, true, false],
        [true, true, false],
        [false, true, false],
        [false, true, false],
        [true, true, true],
      ],
      "2": [
        [true, true, true],
        [false, false, true],
        [true, true, true],
        [true, false, false],
        [true, true, true],
      ],
      "3": [
        [true, true, true],
        [false, false, true],
        [true, true, true],
        [false, false, true],
        [true, true, true],
      ],
      "4": [
        [true, false, true],
        [true, false, true],
        [true, true, true],
        [false, false, true],
        [false, false, true],
      ],
      "5": [
        [true, true, true],
        [true, false, false],
        [true, true, true],
        [false, false, true],
        [true, true, true],
      ],
      "6": [
        [true, true, true],
        [true, false, false],
        [true, true, true],
        [true, false, true],
        [true, true, true],
      ],
      "7": [
        [true, true, true],
        [false, false, true],
        [false, false, true],
        [false, false, true],
        [false, false, true],
      ],
      "8": [
        [true, true, true],
        [true, false, true],
        [true, true, true],
        [true, false, true],
        [true, true, true],
      ],
      "9": [
        [true, true, true],
        [true, false, true],
        [true, true, true],
        [false, false, true],
        [true, true, true],
      ],
      ":": [
        [false, false, false],
        [false, true, false],
        [false, false, false],
        [false, true, false],
        [false, false, false],
      ],
    };

    let currentX = startX;
    for (const char of timeText) {
      const pattern = digitPatterns[char];
      if (pattern) {
        for (let y = 0; y < pattern.length; y++) {
          for (let x = 0; x < pattern[y].length; x++) {
            if (pattern[y][x]) {
              ctx.fillStyle = 'white';
              ctx.fillRect((currentX + x) * PIXEL_SIZE, (startY + y) * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
            }
          }
        }
      }
      currentX += 4;
    }
  }, [pixels, timeLeft]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const devicePixelRatio = window.devicePixelRatio || 1;

    // 设置高分辨率画布
    canvas.width = CANVAS_WIDTH * PIXEL_SIZE * devicePixelRatio;
    canvas.height = CANVAS_HEIGHT * PIXEL_SIZE * devicePixelRatio;
    canvas.style.width = `${CANVAS_WIDTH * PIXEL_SIZE}px`;
    canvas.style.height = `${CANVAS_HEIGHT * PIXEL_SIZE}px`;

    ctx.scale(devicePixelRatio, devicePixelRatio);

    drawCanvas();
  }, [drawCanvas, CANVAS_WIDTH, CANVAS_HEIGHT]);

  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentUser) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left - 2) / PIXEL_SIZE);
    const y = Math.floor((event.clientY - rect.top - 2) / PIXEL_SIZE);

    const isProtectedArea = x >= startX && x < startX + totalWidth && y >= startY && y < startY + 5;
    if (isProtectedArea) return;

    if (x >= 0 && x < CANVAS_WIDTH && y >= 0 && y < CANVAS_HEIGHT) {
      try {
        await api.countdown.countdownUpdatePixel(x, y, !pixels[y][x]);
      } catch (e) {
        showErrorMsg(e, t);
      }
    }
    await mutate();
  };

  if (!countdownData) {
    return null;
  }

  return (
    <div className="w-full flex flex-col items-center my-4">
      <Center>
        <Stack align="center" gap="md">
          <Title>{t('countdown.title')}</Title>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH * PIXEL_SIZE}
            height={CANVAS_HEIGHT * PIXEL_SIZE}
            onClick={handleCanvasClick}
            className={classes.grid}
            aria-description={`Countdown is ${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds`}
          />
          <div>
            <Text display="block">{t('countdown.hint')}</Text>
          </div>
        </Stack>
      </Center>
    </div>
  );
};

export default Countdown;
