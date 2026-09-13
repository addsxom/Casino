const zlib = require('zlib');
const { formatAmount } = require('../formatAmount.js');
const { getHandValue } = require('./gameRules.js');

const WIDTH = 900;
const HEIGHT = 540;

const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','11011','10001'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  0:['01110','10001','10011','10101','11001','10001','01110'],1:['00100','01100','00100','00100','00100','00100','01110'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],'-':['00000','00000','00000','11111','00000','00000','00000'],':':['00000','00100','00100','00000','00100','00100','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],'/':['00001','00010','00100','01000','10000','00000','00000'],' ':['00000','00000','00000','00000','00000','00000','00000']
};
const SUIT_GLYPHS={
 '♥':['0110110','1111111','1111111','0111110','0011100','0001000','0000000'],
 '♦':['0001000','0011100','0111110','1111111','0111110','0011100','0001000'],
 '♣':['0011100','0111110','0011100','1111111','1111111','0011100','0011100'],
 '♠':['0001000','0011100','0111110','1111111','1011101','0011100','0011100']
};
function normalizeText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9+\-:./ ]+/g,' ').replace(/\s+/g,' ').trim().toUpperCase();}
function setPixel(data,x,y,r,g,b,a=255){x=Math.round(x);y=Math.round(y);if(x<0||x>=WIDTH||y<0||y>=HEIGHT)return;const i=(y*WIDTH+x)*4;if(a>=255){data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255;return;}const inv=255-a;data[i]=Math.round((r*a+data[i]*inv)/255);data[i+1]=Math.round((g*a+data[i+1]*inv)/255);data[i+2]=Math.round((b*a+data[i+2]*inv)/255);data[i+3]=255;}
function fillRect(d,x,y,w,h,c){const[r,g,b,a=255]=c;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)setPixel(d,xx,yy,r,g,b,a);}
function strokeRect(d,x,y,w,h,c,t=1){fillRect(d,x,y,w,t,c);fillRect(d,x,y+h-t,w,t,c);fillRect(d,x,y,t,h,c);fillRect(d,x+w-t,y,t,h,c);}
function fillCircle(d,cx,cy,r,c){for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r)setPixel(d,cx+x,cy+y,...c);}
function fillTriangle(d,x1,y1,x2,y2,x3,y3,c){const minX=Math.floor(Math.min(x1,x2,x3)),maxX=Math.ceil(Math.max(x1,x2,x3)),minY=Math.floor(Math.min(y1,y2,y3)),maxY=Math.ceil(Math.max(y1,y2,y3));const area=(x2-x1)*(y3-y1)-(y2-y1)*(x3-x1);for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const a=((x2-x)*(y3-y)-(y2-y)*(x3-x))/area,b=((x3-x)*(y1-y)-(y3-y)*(x1-x))/area,cw=1-a-b;if(a>=0&&b>=0&&cw>=0)setPixel(d,x,y,...c);}}
function drawGlyph(d,ch,x,y,s,c){const g=FONT[ch]||FONT[' '];for(let gy=0;gy<7;gy++)for(let gx=0;gx<5;gx++)if(g[gy][gx]==='1')fillRect(d,x+gx*s,y+gy*s,s,s,c);}
function measureText(t,s){return Math.max(0,normalizeText(t).length*(6*s)-s);}
function drawText(d,t,x,y,s,c){t=normalizeText(t);for(const ch of t){drawGlyph(d,ch,x,y,s,c);x+=6*s;}}
function drawCenteredText(d,t,cx,y,s,c,max=Infinity){t=normalizeText(t);while(s>1&&measureText(t,s)>max)s--;drawText(d,t,Math.round(cx-measureText(t,s)/2),y,s,c);}
function drawSuit(d,suit,cx,cy,size,color){const g=SUIT_GLYPHS[suit]||SUIT_GLYPHS['♠'];const s=Math.max(1,Math.floor(size/7)),x0=Math.round(cx-7*s/2),y0=Math.round(cy-7*s/2);for(let y=0;y<7;y++)for(let x=0;x<7;x++)if(g[y][x]==='1')fillRect(d,x0+x*s,y0+y*s,s,s,color);}
function verticalGradient(d,y0,y1,top,bottom){for(let y=y0;y<y1;y++){const t=(y-y0)/Math.max(1,y1-y0-1);const c=[0,1,2].map(i=>Math.round(top[i]*(1-t)+bottom[i]*t));fillRect(d,0,y,WIDTH,1,[...c,255]);}}
function drawBackground(d){
 verticalGradient(d,0,310,[10,5,18],[37,12,55]);
 for(let i=0;i<9;i++){const x=30+i*105;fillRect(d,x,70,48,210,[60,22,87,70]);fillRect(d,x+18,70,3,210,[170,85,202,50]);}
 fillRect(d,36,20,828,58,[9,7,14,240]);strokeRect(d,36,20,828,58,[205,153,68,255],3);strokeRect(d,43,27,814,44,[95,46,110,255],1);
 drawCenteredText(d,'BLACKJACK  FORTUNA LOUNGE',450,36,3,[237,203,128,255],760);
 fillCircle(d,450,150,47,[183,126,92,255]);
 fillCircle(d,450,125,48,[28,18,25,255]);fillRect(d,413,128,74,26,[183,126,92,255]);
 fillRect(d,438,176,24,28,[224,207,191,255]);
 fillTriangle(d,335,290,395,185,450,245,[18,18,24,255]);fillTriangle(d,565,290,505,185,450,245,[18,18,24,255]);fillRect(d,390,185,120,120,[20,19,26,255]);
 fillTriangle(d,411,188,450,256,435,188,[223,218,212,255]);fillTriangle(d,489,188,450,256,465,188,[223,218,212,255]);
 fillTriangle(d,392,186,440,254,410,262,[86,38,112,255]);fillTriangle(d,508,186,460,254,490,262,[86,38,112,255]);
 fillTriangle(d,426,195,449,207,449,190,[84,38,111,255]);fillTriangle(d,474,195,451,207,451,190,[84,38,111,255]);
 fillTriangle(d,391,225,280,286,405,292,[19,18,24,255]);fillTriangle(d,509,225,620,286,495,292,[19,18,24,255]);
 fillCircle(d,292,284,19,[183,126,92,255]);fillCircle(d,608,284,19,[183,126,92,255]);
 fillRect(d,0,300,WIDTH,18,[94,57,25,255]);fillRect(d,0,304,WIDTH,5,[220,160,67,255]);
 verticalGradient(d,309,HEIGHT,[7,91,62],[3,48,35]);
 fillRect(d,20,328,860,192,[4,62,44,255]);strokeRect(d,20,328,860,192,[164,111,44,255],2);
 strokeRect(d,35,342,830,165,[43,124,88,120],1);
}
function drawCard(d,card,x,y,w=60,h=82,hidden=false){fillRect(d,x+4,y+5,w,h,[0,0,0,95]);if(hidden){fillRect(d,x,y,w,h,[28,12,49,255]);strokeRect(d,x,y,w,h,[214,157,65,255],2);for(let yy=y+8;yy<y+h-6;yy+=10)for(let xx=x+8;xx<x+w-6;xx+=10){fillRect(d,xx,yy,2,2,[137,76,197,255]);fillRect(d,xx+3,yy+3,2,2,[214,157,65,255]);}drawCenteredText(d,'F',x+w/2,y+29,3,[232,199,122,255],w-8);return;}fillRect(d,x,y,w,h,[246,241,232,255]);strokeRect(d,x,y,w,h,[221,205,177,255],1);const red=card?.suit==='♥'||card?.suit==='♦',c=red?[200,43,58,255]:[20,20,24,255];drawText(d,card?.rank||'?',x+6,y+6,2,c);drawSuit(d,card?.suit||'♠',x+w/2,y+51,25,c);}
function layoutCards(d,hand,{y,cx,maxWidth,hideHoleCard=false}){if(!hand?.length)return;const w=60,count=hand.length,spacing=count<=4?68:Math.max(30,Math.floor((maxWidth-w)/Math.max(1,count-1))),total=w+(count-1)*spacing,start=Math.round(cx-total/2);hand.forEach((card,i)=>drawCard(d,card,start+i*spacing,y,w,82,hideHoleCard&&i===1));}
function splitLines(text,max=48){const words=normalizeText(text).split(' '),lines=[];let line='';for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>max&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines.slice(0,2);}
function numberToColor(color){const v=Number.isInteger(color)?color:0x6b6de6;return[(v>>16)&255,(v>>8)&255,v&255,255];}
function renderBlackjackTable(message,state,{revealDealer=false,statusText='A toi de jouer.',visualStatus=null,visualSubtext=null,color=0x6b6de6}={}){
 const d=Buffer.alloc(WIDTH*HEIGHT*4);drawBackground(d);const gold=[235,200,124,255],light=[247,235,208,255],accent=numberToColor(color);
 const dealerVisible=revealDealer?state.dealer:state.dealer.filter((_,i)=>i!==1),dealerTotal=dealerVisible.length?getHandValue(dealerVisible).total:'-',playerTotal=state.player.length?getHandValue(state.player).total:'-',playerName=normalizeText(message.member?.displayName||message.author.username||'JOUEUR').slice(0,14);
 fillRect(d,45,105,205,90,[8,7,14,235]);strokeRect(d,45,105,205,90,[205,153,68,255],2);drawCenteredText(d,'MISE',147,116,2,gold,185);drawCenteredText(d,`${formatAmount(state.bet)} COINS`,147,145,2,light,185);drawCenteredText(d,state.doubled?'MISE X2':'BLACKJACK 3:2',147,170,2,state.doubled?accent:light,185);
 fillRect(d,650,105,205,90,[8,7,14,235]);strokeRect(d,650,105,205,90,[205,153,68,255],2);drawCenteredText(d,'REGLES',752,116,2,gold,185);drawCenteredText(d,'CROUPIER 17',752,143,2,light,185);drawCenteredText(d,'DOUBLER 1 CARTE',752,165,1,light,185);drawCenteredText(d,'BLACKJACK 3:2',752,179,1,light,185);
 fillRect(d,170,318,560,34,[8,7,14,230]);strokeRect(d,170,318,560,34,accent,2);const lines=splitLines(visualSubtext?`${visualStatus||statusText} / ${visualSubtext}`:(visualStatus||statusText),56);if(lines.length===1)drawCenteredText(d,lines[0],450,328,2,light,530);else{drawCenteredText(d,lines[0],450,323,1,light,530);drawCenteredText(d,lines[1],450,337,1,light,530);}
 fillRect(d,45,365,380,145,[3,43,31,170]);fillRect(d,475,365,380,145,[3,43,31,170]);strokeRect(d,45,365,380,145,[128,89,48,220],1);strokeRect(d,475,365,380,145,[128,89,48,220],1);
 drawCenteredText(d,`CROUPIER ${dealerTotal}`,235,376,2,gold,340);layoutCards(d,state.dealer,{y:402,cx:235,maxWidth:340,hideHoleCard:!revealDealer});
 drawCenteredText(d,`${playerName} ${playerTotal}`,665,376,2,gold,340);layoutCards(d,state.player,{y:402,cx:665,maxWidth:340});
 return encodePng(d);
}
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let v=n;for(let k=0;k<8;k++)v=v&1?0xedb88320^(v>>>1):v>>>1;t[n]=v>>>0;}return t;})();
function crc32(b){let c=0xffffffff;for(const x of b)c=CRC_TABLE[(c^x)&0xff]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data){const tb=Buffer.from(type),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);tb.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([tb,data])),8+data.length);return out;}
function encodePng(data){const scan=Buffer.alloc(HEIGHT*(1+WIDTH*4));for(let y=0;y<HEIGHT;y++){const t=y*(1+WIDTH*4),s=y*WIDTH*4;scan[t]=0;data.copy(scan,t+1,s,s+WIDTH*4);}const h=Buffer.alloc(13);h.writeUInt32BE(WIDTH,0);h.writeUInt32BE(HEIGHT,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);}
module.exports={renderBlackjackTable};
