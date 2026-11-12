"""Doodle Date: self-contained, dialogue-free animated short. Requires Pillow, numpy and imageio-ffmpeg."""
import math, subprocess, wave, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg
W,H=540,960; FPS=12; RED='#e74848'; INK='#202126'; PAPER='#fffefa'
font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def f(n): return ImageFont.truetype(font,n)
def line(d,pts,fill=INK,width=5): d.line(pts,fill=fill,width=width,joint='curve')
def text(d,xy,s,size=25,color=INK):
    d.text(xy,s,font=f(size),fill=color,anchor='mm',align='center',spacing=8,stroke_width=0)
def heart(d,x,y,s,c=RED):
    d.polygon([(x,y+s*.8),(x-s,y),(x-s,y-s*.4),(x-s*.7,y-s*.75),(x-s*.3,y-s*.75),(x,y-s*.35),(x+s*.3,y-s*.75),(x+s*.7,y-s*.75),(x+s,y-s*.4),(x+s,y)],fill=c)
def person(d,x,y,accent=False,pose='sit',phase=0):
    # y is head center
    d.ellipse((x-27,y-27,x+27,y+27),outline=INK,width=5)
    if accent:
        line(d,[(x+12,y-29),(x+29,y-39),(x+34,y-25),(x+19,y-20),(x+12,y-29)],RED,5)
    d.ellipse((x-10,y-5,x-6,y-1),fill=INK);d.ellipse((x+8,y-5,x+12,y-1),fill=INK)
    if pose=='sad': line(d,[(x-8,y+14),(x,y+10),(x+8,y+14)],INK,3)
    else: d.arc((x-9,y+3,x+10,y+17),0,180,fill=INK,width=3)
    line(d,[(x,y+28),(x,y+105)],INK,6)
    if pose=='draw':
        line(d,[(x,y+48),(x+35,y+38),(x+60,y+15)],INK,5);line(d,[(x+57,y+20),(x+68,y-5)],INK,3)
        line(d,[(x,y+50),(x-27,y+75)],INK,5)
    elif pose=='fold':
        line(d,[(x-35,y+55),(x+25,y+78),(x-25,y+75),(x+35,y+55)],INK,5)
    else:
        line(d,[(x,y+48),(x-35,y+72)],INK,5);line(d,[(x,y+48),(x+35,y+72)],INK,5)
    if pose=='sit':
        line(d,[(x,y+105),(x-38,y+135),(x-48,y+166)],INK,6);line(d,[(x,y+105),(x+38,y+135),(x+48,y+166)],INK,6)
    else:
        line(d,[(x,y+105),(x-28,y+165)],INK,6);line(d,[(x,y+105),(x+28,y+165)],INK,6)
def table(d):
    line(d,[(156,630),(384,630)],INK,7);line(d,[(184,632),(168,770)],INK,6);line(d,[(356,632),(372,770)],INK,6)
    d.ellipse((186,613,234,624),outline=INK,width=3);d.ellipse((306,613,354,624),outline=INK,width=3)
def rose(d,x,y):
    line(d,[(x,y+45),(x,y-5)],INK,4);line(d,[(x,y+23),(x-16,y+12),(x,y+15)],INK,3)
    d.ellipse((x-15,y-20,x+15,y+8),fill=RED,outline=INK,width=3);d.arc((x-8,y-14,x+8,y+1),0,300,fill=PAPER,width=2)
def dragon(d,x,y,s=1):
    def p(a,b):return (int(x+a*s),int(y+b*s))
    line(d,[p(-80,30),p(-45,-5),p(-8,5),p(15,-28),p(55,-24),p(75,-7),p(43,0),p(29,23),p(60,45)],INK,5)
    line(d,[p(-40,0),p(-55,-48),p(-5,-13),p(2,5)],INK,5);line(d,[p(-40,30),p(-54,57),p(-26,57)],INK,5)
    d.ellipse((*p(48,-18),*p(54,-12)),fill=RED)
def castle(d,x,y):
    line(d,[(x-78,y+70),(x-78,y-22),(x-57,y-22),(x-57,y-38),(x-40,y-38),(x-40,y-22),(x+40,y-22),(x+40,y-38),(x+57,y-38),(x+57,y-22),(x+78,y-22),(x+78,y+70),(x-78,y+70)],INK,5)
    d.arc((x-19,y+25,x+19,y+95),180,360,fill=INK,width=4)
def frame(t):
    im=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(im)
    # little hand-drawn corner flourishes
    line(d,[(40,95),(68,95)],'#d9d6d0',2);line(d,[(472,95),(500,95)],'#d9d6d0',2)
    if t<3:
        text(d,(270,150),'FIRST DATE…',32);text(d,(270,195),'BUT THEY’RE BOTH ARTISTS.',20)
        person(d,125,475,pose='sit');person(d,415,475,True,'sit');table(d)
        d.ellipse((89,440,97,453),fill=RED);text(d,(270,825),'tick   ·   tick   ·   tick',18,'#99958e')
    elif t<7:
        text(d,(270,150),'A LITTLE IMPRESSION',23);person(d,125,475,pose='draw');person(d,415,475,True,'sit');table(d)
        if t>4: rose(d,270,500)
        if t<4.5: person(d,270,310,pose='sit'); text(d,(270,270),'WAITER',14)
    elif t<11:
        text(d,(270,150),'OH. WE’RE DRAWING NOW?',22);person(d,125,475,pose='sit');person(d,415,475,True,'draw');table(d)
        line(d,[(390,517),(415,552),(440,517)],INK,3);d.polygon([(415,547),(423,557),(415,567),(407,557)],outline=RED,width=3)
        for x,y in [(370,460),(460,445),(450,570)]: text(d,(x,y),'✦',22,RED)
    elif t<15:
        text(d,(270,150),'THE STAKES ESCALATE.',24)
        d.rounded_rectangle((55,530,485,700),40,outline=INK,width=6);d.ellipse((85,670,155,740),outline=INK,width=6);d.ellipse((385,670,455,740),outline=INK,width=6)
        person(d,180,450,pose='sit');person(d,380,390 if t>13 else 450,True,'draw')
        if t>13:
            d.rounded_rectangle((341,465,367,518),7,outline=INK,width=4);line(d,[(345,520),(354,545),(362,520)],RED,4)
        text(d,(270,785),'VROOOM!',32,RED)
    elif t<19:
        text(d,(270,150),'A CASTLE!',27);castle(d,170,560);person(d,90,640,pose='sad');person(d,450,640,True,'draw')
        if t>16: dragon(d,350,470,1.25);text(d,(340,370),'CHOMP.',30,RED)
    elif t<23:
        text(d,(270,150),'A BIGGER DRAGON.',27);dragon(d,295,450,2);person(d,95+max(0,t-20)*20,720,pose='sad');person(d,445,690,True,'draw')
        text(d,(135,650),'NOPE!',23,RED)
    elif t<27:
        text(d,(270,150),'BAD IDEA.',32,RED)
        r=40+min(1,(t-23)/2)*140
        for k in range(3): d.ellipse((270-r-k*18,550-r*.5-k*12,270+r+k*18,550+r*.5+k*12),outline=INK,width=3)
        d.ellipse((270-r,550-r*.5,270+r,550+r*.5),fill=INK)
        person(d,100+(t-23)*30,405+(t-23)*20,pose='sad');person(d,440-(t-23)*30,400+(t-23)*20,True,'sad')
        if t<25: dragon(d,320,345,.5)
    elif t<31:
        text(d,(270,155),'…',40);person(d,155,560,pose='sad');person(d,385,560,True,'fold');line(d,[(75,730),(465,730)],'#d5d2cb',3)
        if t>29: text(d,(270,795),'chirp.',18,'#a8a39c')
    elif t<35:
        text(d,(270,150),'A SMALLER IDEA.',25);person(d,155,560,pose='draw');person(d,385,560,True,'sit')
        if t>32:
            d.pieslice((235,555,305,620),180,360,fill='#f3c868',outline=INK,width=4);line(d,[(239,587),(251,578),(263,587),(276,578),(289,587),(302,580)],RED,3)
        if t>34: text(d,(390,495),'♥',28,RED)
    elif t<40:
        text(d,(270,150),'SIMPLE WINS.',32);person(d,155,560,pose='draw');person(d,385,560,True,'draw')
        dist=max(35,115-(t-35)*25);heart(d,270-dist/2,465,25);heart(d,270+dist/2,465,25)
    else:
        d.rounded_rectangle((55,190,485,745),12,outline='#d3cec4',width=3,fill='#fff')
        for y in range(250,740,65):line(d,[(70,y),(470,y)],'#e6e9ed',2)
        text(d,(270,310),'DOODLE DATE',40);heart(d,270,365,18)
        person(d,175,440,pose='sit');person(d,365,440,True,'sit');heart(d,270,475,22)
        line(d,[(140,690),(400,690)],INK,4)
        d.rounded_rectangle((185,790,355,840),12,outline=RED,width=3);text(d,(270,815),'SUBSCRIBE',19,RED)
    return im

def audio(path):
    sr=22050; dur=45; a=np.zeros(sr*dur,dtype=np.float64); rng=np.random.default_rng(8)
    # Quiet original music: simple alternating plucked chords.
    for i in range(90):
        start=i*.5; chord=([261.63,329.63,392.0],[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66])[(i//4)%4]
        n=int(.45*sr); tt=np.arange(n)/sr; tone=sum(np.sin(2*np.pi*v*tt) for v in chord)/3*np.exp(-tt*5)*.035
        a[int(start*sr):int(start*sr)+n]+=tone
    def effect(start,dur,kind):
        n=int(sr*dur); tt=np.arange(n)/sr; env=np.sin(np.pi*np.arange(n)/n)**2
        if kind=='scratch': sig=rng.normal(0,1,n)*.04
        elif kind=='whoosh': sig=rng.normal(0,1,n)*(.04+.1*tt/dur)
        elif kind=='chime': sig=(np.sin(2*np.pi*880*tt)+np.sin(2*np.pi*1320*tt))*.05*np.exp(-tt*3)
        elif kind=='chirp': sig=np.sin(2*np.pi*(1800*tt+400*tt**2))*.06
        else: sig=np.sin(2*np.pi*(130*tt-65*tt**2/dur))*.09
        i=int(start*sr);a[i:i+n]+=sig*env
    for t in [3.5,7.3,11.3,15.2,19.3,23.2,31.2,35.1,40.5,43]:effect(t,.45,'scratch')
    for t in [4.5,8.2,32.4,36.5]:effect(t,.7,'chime')
    for t in [13.2,16.2,23.5]:effect(t,1.1,'whoosh')
    effect(17.2,.7,'low');effect(29,.3,'chirp')
    data=np.int16(np.clip(a,-1,1)*32767)
    with wave.open(path,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(data.tobytes())

if __name__=='__main__':
    os.makedirs('runtime/renders',exist_ok=True); audio('runtime/renders/doodle-audio.wav')
    cmd=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','540x960','-r',str(FPS),'-i','-','-i','runtime/renders/doodle-audio.wav','-vf','scale=1080:1920:flags=lanczos,format=yuv420p','-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest','runtime/renders/doodle-date.mp4']
    p=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    for i in range(45*FPS):
        p.stdin.write(frame(i/FPS).tobytes())
    p.stdin.close(); assert p.wait()==0
