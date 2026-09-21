window.MUSHI_DATA = (() => {
  const insect = (id,name,color,cost,hp,attacks,passive=null) => ({id,name,type:'insect',color,cost,hp,attacks,passive});
  const enhance = (id,name,cost,effectText,effect) => ({id,name,type:'enhance',color:null,cost,effectText,effect});
  const spell = (id,name,cost,effectText,effect) => ({id,name,type:'spell',color:null,cost,effectText,effect});

  const cards = {
    6: insect(6,'ギンヤンマ','red',5,1100,[{name:'とびかかる',power:700}]),
    7: insect(7,'オオカマキリ','red',4,800,[
      {name:'カマ連撃',power:200,effect:'mantisCombo',text:'攻撃後、相手の場に虫がいれば、もう一度だけ使用できる。'},
      {name:'共食い',power:800,effect:'cannibal',text:'使うとき、この虫以外の自分の虫を1つ選び、破壊する。'}
    ]),
    11: insect(11,'コオニヤンマ','red',4,800,[{name:'とびかかる',power:500}]),
    22: insect(22,'セアカゴケグモ','red',2,400,[
      {name:'かむ',power:100},
      {name:'毒針',power:400,effect:'oncePerEntry',text:'この技は1度だけ使用できる。'}
    ]),
    24: insect(24,'アキアカネ','red',2,500,[{name:'とびかかる',power:200}]),
    30: insect(30,'ナミテントウ','red',1,300,[{name:'かみつぶす',power:100}]),
    40: insect(40,'カブトムシ','blue',4,800,[
      {name:'ツノ突進',power:500},
      {name:'すくい投げ',power:0,effect:'flip',text:'相手の虫を1つ選び、ターン終了時まで裏返す。裏返しの間はいないものとして扱う。'}
    ]),
    44: insect(44,'ナミアゲハ','blue',4,1100,[{name:'すいつくす',power:300}],{type:'pollen',text:'＜りんぷん＞ 相手はこれ以外の虫を攻撃できない。'}),
    47: insect(47,'ミンミンゼミ','blue',3,500,[{name:'しぼりとる',power:200}],{type:'flyOut',text:'＜とびだす＞ 縄張りから引いたとき、条件を満たせばコストなしで場に出せる。'}),
    63: insect(63,'カナブン','blue',1,300,[{name:'たいあたり',power:100}]),
    64: insect(64,'ヒグラシ','blue',2,200,[{name:'しぼりとる',power:200}]),
    71: insect(71,'トノサマバッタ','green',5,1200,[{name:'くらいつく',power:700}]),
    79: insect(79,'ナミアゲハ（幼虫）','green',3,700,[
      {name:'かじる',power:200},
      {name:'くさいツノ',power:0,effect:'stinkHorn',text:'相手の虫を1つ選ぶ。次のターン、その虫の攻撃力を400下げる。'}
    ]),
    80: insect(80,'ナナフシモドキ','green',3,400,[{name:'かぶりつく',power:400}],{type:'mimic',text:'＜擬態＞ 場に出た次の相手のターンに攻撃を受けない。'}),
    91: insect(91,'ニジュウヤホシテントウ','green',2,300,[{name:'かみつぶす',power:300}]),
    95: insect(95,'ワタアブラムシ','green',1,300,[{name:'すう',power:100}]),
    101: enhance(101,'玉虫色の羽化',2,'この虫の色を赤か青か緑に変える。','changeColor'),
    106: enhance(106,'針金虫の道連れ',0,'虫の攻撃によってこの虫が破壊されたとき、この虫を破壊した虫を破壊する。','revenge'),
    107: enhance(107,'天牛の大顎',0,'この虫の攻撃力を300増やす。','attack300'),
    108: enhance(108,'蓑虫の隠れ蓑',0,'この虫の体力を500増やす。','hp500'),
    118: spell(118,'虹の架け橋',1,'自分の捨て札の虫を1つ選び、手札に加える。','recoverInsect'),
    124: spell(124,'塵芥虫の爆熱弾',1,'相手の虫を1つ選び、600ダメージを与える。','burn600'),
    127: spell(127,'蟲の息吹',1,'これを自分のエサ場に置く。※このエサのコストはこのターン発生しない。','baitBoost'),
    129: spell(129,'飛蝗の凶相',0,'ターン終了時まで、使用時に自分の場にいるすべての虫の攻撃力を200増やす。','allAttack200')
  };

  const decks = {
    kabuto: {
      name:'カブトムシデッキ',
      ids:[6,6,40,40,44,44,79,79,91,91,24,24,30,30,63,63,108,124,127,129]
    },
    mantis: {
      name:'オオカマキリデッキ',
      ids:[71,71,7,7,11,11,47,47,80,80,22,22,64,64,95,95,106,107,101,118]
    }
  };
  return {cards,decks};
})();
